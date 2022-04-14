import {BleError, BleManager, Device} from 'react-native-ble-plx';
import {Buffer} from 'buffer';

/** Interface for Blood pressure measurement from the device */
export interface Measurement {
  /** Header. Usually it's constant number which is in the head of the message from device. Not related to the measurement */
  header: number;
  /** Systolic blood pressure */
  systolic: number;
  /** Systolic blood pressure */
  diastolic: number;
  /** Not supported by the BM77. The value is always 0 */
  meanArterialPressure: number;
  /** Date */
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The value of 1 equals a pulse of 1. The valid range is 0-255 */
  pulseRate: number;
  /** The value of 0 represents measurement from user 1 and the value of 1 measurements of user 2 */
  userID: number;
  /** 0 = no body movement | 1 = body movement */
  bodyMovement: string;
  /** 0 = cuff fits properly | 1 = cuff is too loose */
  cuffFit: string;
  /** 0 = no irregular pulse | 1 = irregular pulse */
  irregularPulse: string;
  /** 00 = in range | 01 = exceeds upper limit | 10 = below lower limit | 11 = reserved for future use MSO to LSO */
  pulseRateRange: string;
  /** 0 = proper position | 1 = improper position */
  measurementPosition: string;
  /** 00 = HSD not detected | 01 = HSD detected | 10 = unable to judge MSO to LSO.
   * Not defined by Bluetooth SIG. The HSD value is represented by 2 bit.
   */
  HSD: string;
}

export enum ConnectionStatus {
  CONNECTED,
  DISCONNECTED,
}
/** This class controls connection to device and device itself */
export class BM77 {
  deviceName = 'BM77';
  service = '00001810-0000-1000-8000-00805f9b34fb';
  characteristicNotify = '00002a35-0000-1000-8000-00805f9b34fb';

  constructor(private bleManager: BleManager) {}

  /**
   * Scans specifically for bm77 by name
   *
   * Please make sure device BM77 has activated bluetooth mode (It can be activated on the device after first launch
   * or after battery change.)
   *
   * Device will allow you to connect when Ble label will start blinking on the display of the device.
   * This can be triggered by clicking on the M1 or M2 short after starting the device.
   * It is also triggered after every measurement.
   *
   */
  async startScan(): Promise<Device> {
    return new Promise((resolve, reject) => {
      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          this.bleManager.stopDeviceScan();
          reject(error);
        }
        if (device?.name === this.deviceName) {
          this.bleManager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  /** Manually stops scan */
  stopScan(): void {
    this.bleManager.stopDeviceScan();
  }
  /** Connects and discovers services and characteristics */
  async connect(
    device: Device,
    onDisconnect: (status: ConnectionStatus) => void,
  ) {
    await device.connect();
    console.log('Device was connected');
    await this.discoverWithDelay(device);
    device.onDisconnected(() => {
      console.log('Device was disconnected');
      onDisconnect(ConnectionStatus.DISCONNECTED);
    });
  }

  /** Sometimes device refuses to connect and immediately discover services and characteristics, so we create a little delay */
  /** @param device can be received from startScan method if device is on and ble function is activated on the device. */
  private discoverWithDelay(device: Device) {
    return new Promise(resolve => {
      setTimeout(async () => {
        const result = await device.discoverAllServicesAndCharacteristics();
        resolve(result);
        console.log('Services and characteristics were discovered');
      }, 1600);
    });
  }

  /** Set up a listener to receive data. Device will start to send data immediately after listener is set up
   * The device is sending all data from both users.
   * @param onData callback will return measurements until all data is being retrieved
   * @param device can be received from startScan method if device is on and ble function is activated on the device.
   */
  async receiveData(
    device: Device,
    onError: (error: BleError) => void,
    onData: (data: Measurement) => void,
  ) {
    device.monitorCharacteristicForService(
      this.service,
      this.characteristicNotify,
      (error, result) => {
        if (error) {
          onError(error);
        }
        if (result?.value) {
          const measurementInHex = this.base64ToHex(result.value);
          const measurement = this.convertBloodPressure(measurementInHex);
          onData(measurement);
        }
      },
    );
  }

  /**
   * Converts data measurements from device.
   * Each message from device is one measurement and length of one measurement is 20 bytes
   * Unfortunately, we can't predict when exactly data will stop coming from device as device was created
   * based on SIG profile for blood pressure
   * @param hexArray data from the device in hexadecimal format
   */
  private convertBloodPressure = (hexArray: string[]) => {
    /**
     * Measurement Status – Part of Blood Pressure Measurement
     * The measurement status has a size of 2 bytes and is part of the blood pressure measurement Indication.
     * The value of the measurement status is reversed the order is MSO to LSO.
     */
    const statusFlagsOne = this.hex2bin(hexArray[17]);

    const result: Measurement = {
      header: parseInt(hexArray[0], 16),
      systolic: parseInt(hexArray[2] + hexArray[1], 16),
      diastolic: parseInt(hexArray[4] + hexArray[3], 16),
      meanArterialPressure: parseInt(hexArray[5], 16),
      year: parseInt(hexArray[8] + hexArray[7], 16),
      month: parseInt(hexArray[9], 16),
      day: parseInt(hexArray[10], 16),
      hours: parseInt(hexArray[11], 16),
      minutes: parseInt(hexArray[12], 16),
      seconds: parseInt(hexArray[13], 16),
      pulseRate: parseInt(hexArray[15] + hexArray[14], 16),
      userID: parseInt(hexArray[16], 16),
      bodyMovement:
        statusFlagsOne[0] === '0' ? 'No body movement' : 'Body movement',
      cuffFit:
        statusFlagsOne[1] === '0' ? 'Cuff fits properly' : 'Cuff is too loose',
      irregularPulse:
        statusFlagsOne[2] === '0' ? 'No irregular pulse' : 'Irregular pulse',
      pulseRateRange: this.pulseRateConvert(
        statusFlagsOne[3] + statusFlagsOne[4],
      ),
      measurementPosition:
        statusFlagsOne[5] === '0' ? 'Proper position' : 'Improper position',
      HSD: this.HSDConvert(statusFlagsOne[6] + statusFlagsOne[7]),
    };

    console.log(JSON.stringify(result));
    return result;
  };

  /**
   * Converting status of the measurement
   * @param binary part of the measurement
   */
  private pulseRateConvert = (binary: string): string => {
    switch (binary) {
      case '00':
        return 'In range';
      case '01':
        return 'Exceeds upper limit';
      case '10':
        return 'Below lower limit';
      default:
        return 'Undefined';
    }
  };

  /**
   * Converting status of the HSD(Hypermobility spectrum disorders)
   * @param binary part of the measurement
   */
  private HSDConvert = (binary: string): string => {
    switch (binary) {
      case '00':
        return 'HSD not detected';
      case '01':
        return 'HSD detected';
      case '10':
        return 'Unable to judge';
      default:
        return 'Undefined';
    }
  };

  /**
   * Simply converts hexadecimal to binary
   * @param hexOneByte
   */
  private hex2bin = (hexOneByte: string): string => {
    return ('00000000' + parseInt(hexOneByte, 16).toString(2)).substr(-8);
  };

  /**
   * Simply converts base64 to hexadecimal format. As library ble-plx converts data in base64 format
   * @param base64
   * @returns array of string, each string is equal to one byte. ex ['01','a1',...]
   */
  private base64ToHex = (base64: string): string[] => {
    const array: string[] = [];
    if (base64 !== null && base64 !== undefined) {
      const hexString = Buffer.from(base64, 'base64').toString('hex');
      for (let i = 0, charsLength = hexString.length; i < charsLength; i += 2) {
        array.push(hexString.substring(i, i + 2));
      }
    }
    return array;
  };
}
