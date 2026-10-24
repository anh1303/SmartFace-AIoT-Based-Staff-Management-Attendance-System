"""Same edge_client with C to capture unlabelled or labelled expanded PAD crops.

Example:
  python app_capture.py --subject person01 --condition backlight
  python app_capture.py --subject loc --condition room_normal --label real
  python app_capture.py --subject attacker --condition room_normal --label fake
"""
import sys
from pathlib import Path

if __name__ == '__main__':
    if '--capture-dir' not in sys.argv and not any(a.startswith('--capture-dir=') for a in sys.argv):
        sys.argv.extend(['--capture-dir', str(Path(__file__).resolve().parent / 'pad_captures')])
    from edge_client import main, parse_args
    main(parse_args())
