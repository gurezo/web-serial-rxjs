import {
  createSerialSession,
  isWebSerialSupported,
  SerialSessionStatus,
} from '@gurezo/web-serial-rxjs';

const required = {
  createSerialSession,
  isWebSerialSupported,
  SerialSessionStatus,
};

for (const [name, value] of Object.entries(required)) {
  if (value === undefined) {
    throw new Error(`ESM import missing export: ${name}`);
  }
}
