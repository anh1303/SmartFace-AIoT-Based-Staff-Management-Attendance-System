"""Physical acceptance tests. RAM only; never store/delete sensor Flash.

Run outside edge_client; UART lock prevents simultaneous app/test access.
Outputs non-biometric JSON metrics. Same-finger and different-finger prompts
must be followed by the operator; there is no automated physical identity oracle.
"""
import argparse
import json
from pathlib import Path
import time
from peripherals.fingerprint_sensor import FingerprintSensor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', default='/dev/serial0')
    parser.add_argument('--touch-pin', type=int, default=17)
    parser.add_argument('--trials', type=int, default=20)
    parser.add_argument('--output', default='/tmp/smartface-fingerprint-acceptance.json')
    args = parser.parse_args()
    if args.trials < 1:
        parser.error('--trials must be positive')
    from gpiozero import DigitalInputDevice
    sensor = FingerprintSensor(args.port, timeout=3)
    touch = DigitalInputDevice(args.touch_pin, pull_up=False, bounce_time=.1)
    report = {'correct_within_5s': 0, 'different_rejected': 0, 'wak_cycles': 0, 'transport_errors': 0,
              'roundtrip_verified': False, 'trials': args.trials, 'accepted': False}
    def checked(code):
        if code >= 0xf9:
            report['transport_errors'] += 1
            raise RuntimeError('UART timeout/desynchronization')
        return code
    def lift():
        print('Nhấc hẳn tay khỏi kính', flush=True)
        end=time.monotonic()+30;clear=None
        while time.monotonic()<end:
            if not touch.is_active:
                clear=clear or time.monotonic()
                if time.monotonic()-clear>=.2:return
            else:clear=None
            time.sleep(.05)
        raise TimeoutError('WAK không báo nhấc tay')
    def capture(buffer, timeout=60):
        end=time.monotonic()+timeout;started=None
        while time.monotonic()<end:
            if touch.is_active:
                started=started or time.monotonic()
                if checked(sensor.capture_image())==0 and checked(sensor.image_to_charbuffer(buffer))==0:
                    return time.monotonic()-started
                if time.monotonic()-started>5:
                    return None
            time.sleep(.1)
        raise TimeoutError('Không nhận được chạm WAK trong 60s')
    try:
        if not sensor.connect():raise RuntimeError(sensor.last_error)
        count=sensor.get_template_count()
        report['initial_flash_count']=count
        print('Tạo mẫu tham chiếu trong RAM. Đặt cùng một ngón hai lần theo hướng dẫn.')
        lift();print('Đặt ngón tham chiếu lần 1',flush=True)
        if capture(1) is None:raise RuntimeError('Mẫu đầu chưa đạt trong 5s')
        lift();print('Đặt lại cùng ngón lần 2',flush=True)
        if capture(2) is None:raise RuntimeError('Mẫu thứ hai chưa đạt trong 5s')
        if checked(sensor.match_buffers()[0])!=0 or checked(sensor.create_model())!=0:
            raise RuntimeError('Hai mẫu không khớp')
        template=sensor.upload_template(1)
        if not template or not sensor.download_template(2,template) or sensor.upload_template(2)!=template:
            raise RuntimeError('Không khôi phục được template từ RAM')
        report['roundtrip_verified']=True
        # Keep buffer 1 as reference, use buffer 2 for every trial; do not merge again.
        for kind in ['correct','different']:
            input(('Chuẩn bị CÙNG NGÓN đã đăng ký' if kind=='correct' else 'Chuẩn bị NGÓN KHÁC')+'; nhấn Enter khi sẵn sàng: ')
            for i in range(args.trials):
                lift();print(f'{kind} {i+1}/{args.trials}: đặt ngón tay',flush=True)
                elapsed=capture(2)
                if elapsed is not None:
                    code,score=sensor.match_buffers();checked(code)
                    if kind=='correct' and code==0:report['correct_within_5s']+=1
                    if kind=='different' and code==8:report['different_rejected']+=1
                    print('Kết quả',hex(code),'điểm',score,'giây',round(elapsed,2),flush=True)
                else:print('Chưa lấy được mẫu trong 5 giây',flush=True)
                lift();report['wak_cycles']+=1
        report['final_flash_count']=sensor.get_template_count()
        report['accepted']=(args.trials>=20 and report['correct_within_5s']>=18
          and report['different_rejected']==args.trials and report['wak_cycles']>=20
          and not report['transport_errors'] and count==report['final_flash_count'])
    except (Exception,KeyboardInterrupt) as exc:
        report['error']=type(exc).__name__
        print('Kiểm thử dừng:',str(exc))
    finally:
        sensor.close();touch.close()
        Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(report,ensure_ascii=False))
    return 0 if report['accepted'] else 1


if __name__=='__main__':raise SystemExit(main())
