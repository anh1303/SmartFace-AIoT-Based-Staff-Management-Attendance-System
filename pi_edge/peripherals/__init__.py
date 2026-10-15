"""
Module peripherals: Chứa các driver và dịch vụ giao tiếp phần cứng ngoại vi (Sensors, Displays, Actuators).
"""

from .ultrasonic_sensor import UltrasonicSensor

__all__ = ["UltrasonicSensor"]
