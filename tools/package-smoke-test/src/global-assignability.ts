import type {
  SerialOptions as PackagedSerialOptions,
  SerialPortFilter as PackagedSerialPortFilter,
  SerialPortInfo as PackagedSerialPortInfo,
} from '@gurezo/web-serial-rxjs';

/**
 * Included only by tsconfig.strict-with-web-serial-types.json (Issue #659).
 * Assigning across the packaged dictionaries and the ambient globals fails
 * the strict typecheck when the shapes collide.
 */
declare const packagedInfo: PackagedSerialPortInfo;
declare const globalInfo: SerialPortInfo;
const infoFromPackage: SerialPortInfo = packagedInfo;
const infoFromGlobal: PackagedSerialPortInfo = globalInfo;

declare const packagedFilter: PackagedSerialPortFilter;
declare const globalFilter: SerialPortFilter;
const filterFromPackage: SerialPortFilter = packagedFilter;
const filterFromGlobal: PackagedSerialPortFilter = globalFilter;

declare const packagedOptions: PackagedSerialOptions;
declare const globalOptions: SerialOptions;
const optionsFromPackage: SerialOptions = packagedOptions;
const optionsFromGlobal: PackagedSerialOptions = globalOptions;

void infoFromPackage;
void infoFromGlobal;
void filterFromPackage;
void filterFromGlobal;
void optionsFromPackage;
void optionsFromGlobal;
