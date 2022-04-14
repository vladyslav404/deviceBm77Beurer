import React, {useEffect, useRef, useState} from 'react';
import {FlatList, Image, StyleSheet, Text, View} from 'react-native';

import {BleError, BleManager, Device} from 'react-native-ble-plx';
import {BM77, Measurement} from './src/device-controller';
import {Help} from './src/helpers';
import {
  ActivityIndicator,
  Button,
  Card,
  Colors,
  Dialog,
  Paragraph,
  Portal,
  Provider,
  Title,
} from 'react-native-paper';

enum BleState {
  SCAN = 'Scan',
  SCANNING = 'Scanning...',
  FOUND = 'Connect to the device',
  CONNECTING = 'Connecting...',
  CONNECTED = 'Connected',
  RECEIVING = 'R',
  DISCONNECTED = 'D',
}

const App = () => {
  /** List for measurements */
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  /** State of the screen */
  const [state, setState] = useState<BleState>(BleState.DISCONNECTED);
  /** Bluetooth Manager from ble-plx library */
  const bleManager = useRef<BleManager>();
  /** Device which can be received from scan */
  const device = useRef<Device>();
  /** Class to find, connect device and receive data from it */
  const deviceController = useRef<BM77>();
  /** Error message*/
  const [errorMsg, setErrorMsg] = useState<string>('');

  /**
   * 1) Create instance of the bluetooth manager
   * 2) Create instance of the BM77 class with instance of the bluetooth manager
   */
  useEffect(() => {
    bleManager.current = new BleManager();
    deviceController.current = new BM77(bleManager.current);
  }, []);

  /** Rendering components depending on the state */
  const renderState = () => {
    /** If we haven't received measurements yet and device is disconnected. It's a starting point */
    if (measurements.length === 0 && state === BleState.DISCONNECTED) {
      return (
        <Button
          onPress={async () => {
            if (bleManager.current) {
              try {
                setState(BleState.SCANNING);
                await Help.checkBleConfig(bleManager.current);
                device.current = await deviceController.current?.startScan();
                setState(BleState.FOUND);
              } catch (e) {
                if (e instanceof Error || e instanceof BleError) {
                  setErrorMsg(e.message);
                }
              }
            }
          }}>
          Start scan
        </Button>
      );
    } else {
      /** Every other state means that we are already interacting with bluetooth and device */
      switch (state) {
        /** We start scan to find a device */
        case BleState.SCANNING:
          return (
            <View style={styles.container}>
              <ActivityIndicator animating={true} color={Colors.red800} />
              <Text style={styles.textStyle}>Scanning...</Text>
              <Button
                onPress={() => {
                  setState(BleState.DISCONNECTED);
                  deviceController.current?.stopScan();
                }}>
                Cancel Scan
              </Button>
            </View>
          );
        /** Device found, so we can press a button to connect to it */
        case BleState.FOUND:
          return (
            <Button
              onPress={async () => {
                if (device.current) {
                  setState(BleState.CONNECTING);
                  try {
                    await deviceController.current?.connect(
                      device?.current,
                      () => {
                        if (measurements.length !== 0) {
                          //                          Toast.show('Data has been received');
                        }
                      },
                    );
                  } catch (e) {
                    if (e instanceof BleError) {
                      setErrorMsg(e.message);
                    }
                  }
                  setState(BleState.CONNECTED);
                }
              }}>
              Connect to {device.current?.name ?? 'Not found'}
            </Button>
          );
        case BleState.CONNECTING:
          return (
            <View style={styles.container}>
              <ActivityIndicator animating={true} color={Colors.red800} />
              <Text style={styles.textStyle}>Connecting...</Text>
            </View>
          );
        case BleState.CONNECTED:
          return (
            <Button
              onPress={() => {
                if (device.current) {
                  setState(BleState.RECEIVING);
                  deviceController.current?.receiveData(
                    device?.current,
                    error =>
                      error.errorCode === 201
                        ? setErrorMsg(error.message)
                        : null,
                    data => setMeasurements(prevState => [...prevState, data]),
                  );
                }
              }}>
              Receive Data
            </Button>
          );
        case BleState.RECEIVING:
          return (
            <View>
              <Button
                onPress={() => {
                  setMeasurements([]);
                  setState(BleState.DISCONNECTED);
                }}>
                Start again
              </Button>
              <Card>
                <Card.Content>
                  <Title>Amount of measurements: {measurements.length}</Title>
                </Card.Content>
              </Card>
              <FlatList
                data={measurements}
                renderItem={({item}) => (
                  <Card>
                    <Card.Content>
                      <Title>{`Blood Pressure: ${item.systolic}/${item.diastolic} mmHg Pulse: ${item.pulseRate}`}</Title>
                      <Paragraph>{`User ID: ${item.userID}`}</Paragraph>
                      <Paragraph>{`${item.bodyMovement}`}</Paragraph>
                      <Paragraph>{`${item.cuffFit}`}</Paragraph>
                      <Paragraph>{`${item.irregularPulse}`}</Paragraph>
                      <Paragraph>{`${item.pulseRateRange}`}</Paragraph>
                      <Paragraph>{`${item.measurementPosition}`}</Paragraph>
                      <Paragraph>{`${item.HSD}`}</Paragraph>
                    </Card.Content>
                  </Card>
                )}
                keyExtractor={_item => Math.random().toString()}
              />
            </View>
          );
        default:
          console.log('Undefined state');
          return (
            <Button
              onPress={() => {
                setMeasurements([]);
                setState(BleState.DISCONNECTED);
              }}>
              Start again
            </Button>
          );
      }
    }
  };

  return (
    <Provider>
      <Portal>
        <View style={styles.container}>
          <Text style={styles.textTitle}>Scan</Text>
          <Text style={styles.textSubtitle}>Start scanning for the device</Text>

          <Image
            style={styles.image}
            source={require('./assets/images/ble.jpg')}
          />

          <Button onPress={() => {}}>GE</Button>
        </View>
        {
          //<View style={styles.container}>{renderState()}</View>
        }
        <Dialog
          visible={errorMsg !== ''}
          onDismiss={() => {
            setState(BleState.DISCONNECTED);
            setErrorMsg('');
          }}>
          <Dialog.Actions>
            <Text>{errorMsg}</Text>
            <Button
              onPress={() => {
                setState(BleState.DISCONNECTED);
                setErrorMsg('');
              }}>
              Ok
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Provider>
  );
};

/**
 * for parent:
 * flexDirection: ‘column’/’column-reverse’/’row’/’row-reverse’
 * flex
 * justifyContent: ‘flex-start’/’flex-end’/’center’/’space-between’/’space-around’
 * alignItems: ‘flex-start’, ‘flex-end’, ‘center’, ‘stretch’
 * Note: stretch wouldn’t work if you have a specific width
 * Note: If you don’t have a specific width flex-start and flex-end wouldn’t understand what to do…
 * for children:
 * flex
 * alignSelf: ‘flex-start’, ‘flex-end’, ‘center’, ‘stretch’
 * Note: align an item along the cross axis overwriting his parent alignItem property
 *
 */
const styles = StyleSheet.create({
  textTitle: {
    textAlign: 'center',
    color: '#000000',
    fontSize: 36,
    flex: 1,
  },
  textSubtitle: {
    flex: 1,
    textAlign: 'center',
    color: '#7D7D7D',
    fontSize: 20,
  },
  buttonStyle: {
    flex: 1,
    backgroundColor: '#F1F1F1',
  },
  container: {
    flex: 1,
    backgroundColor: '#F1F1F1',
  },
  image: {
    flex: 1,
  },
});

export default App;
