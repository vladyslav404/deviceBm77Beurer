import {PermissionsAndroid, Platform} from 'react-native';
import {BleManager, State} from 'react-native-ble-plx';

export class Help {
  static checkBleConfig = async (bleManager: BleManager): Promise<boolean> => {
    let isGranted = false;
    if (Platform.OS === 'android') {
      isGranted = await this.requestLocationPermission();
    }
    //add other statuses for ble, otherwise e.g. it asks to open ble, when ble is loading
    if (isGranted || Platform.OS === 'ios') {
      const bleState = await bleManager.state();
      if (bleState === State.PoweredOn) {
        return true;
      } else {
        throw new Error('Please, activate your bluetooth');
      }
    } else {
      throw new Error(
        'Please, give a location permission. Otherwise, bluetooth connection is not possible.',
      );
    }
  };
  private static requestLocationPermission = async (): Promise<boolean> => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission for Bluetooth',
          message: 'Requirement for Bluetooth',
          buttonNeutral: 'Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  };
}
