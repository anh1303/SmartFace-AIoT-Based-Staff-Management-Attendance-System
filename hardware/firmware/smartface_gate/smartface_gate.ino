#include <Servo.h>
#include <stdlib.h>
#include <string.h>

constexpr uint8_t SERVO_PIN = 9;
constexpr int MIN_PULSE_US = 500;
constexpr int MAX_PULSE_US = 2500;
Servo gate;
char line[32];
uint8_t length = 0;
bool overflow = false;

void handleCommand() {
  if (strcmp(line, "PING") == 0) {
    Serial.println(F("PONG SMARTFACE_GATE"));
    return;
  }
  if (strcmp(line, "DETACH") == 0) {
    gate.detach();
    Serial.println(F("OK DETACH"));
    return;
  }
  if (strncmp(line, "SERVO ", 6) == 0) {
    char *end;
    const long pulse = strtol(line + 6, &end, 10);
    if (*end == '\0' && pulse >= MIN_PULSE_US && pulse <= MAX_PULSE_US) {
      // Preload the target before enabling pulses to avoid a center-position kick.
      gate.writeMicroseconds(pulse);
      if (!gate.attached()) gate.attach(SERVO_PIN, MIN_PULSE_US, MAX_PULSE_US);
      gate.writeMicroseconds(pulse);
      Serial.print(F("OK SERVO "));
      Serial.println(pulse);
      return;
    }
  }
  Serial.println(F("ERR INVALID_COMMAND"));
}

void setup() {
  Serial.begin(115200);
  Serial.println(F("READY SMARTFACE_GATE"));
}

void loop() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r') continue;
    if (c == '\n') {
      if (overflow) Serial.println(F("ERR LINE_TOO_LONG"));
      else if (length > 0) {
        line[length] = '\0';
        handleCommand();
      }
      length = 0;
      overflow = false;
    } else if (!overflow) {
      if (length < sizeof(line) - 1) line[length++] = c;
      else overflow = true;
    }
  }
}
