import {
  createSerialSession,
  isWebSerialSupported,
  SerialSessionStatus,
  type ConnectedSessionState,
  type SerialSessionOptions,
} from '@gurezo/web-serial-rxjs';

const options: SerialSessionOptions = {
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }],
};

const session = createSerialSession(options);

function readVendorId(state: ConnectedSessionState): number | undefined {
  return state.portInfo.usbVendorId;
}

// Keep references so tsc and the ESM runtime import stay meaningful.
void session;
void readVendorId;
void createSerialSession;
void isWebSerialSupported;
void SerialSessionStatus;
