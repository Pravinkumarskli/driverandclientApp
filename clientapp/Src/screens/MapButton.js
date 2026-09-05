import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking, Alert} from 'react-native';

const MapButton = ({carLocation, homeLocation}) => {
  console.log('carLocation:', carLocation);
  console.log('homeLocation:', homeLocation);

  const openGoogleMaps = async () => {
    // Your data is [longitude, latitude]
    const [carLng, carLat] = carLocation;
    const [homeLng, homeLat] = homeLocation;

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${carLat},${carLng}` +
      `&destination=${homeLat},${homeLng}` +
      `&travelmode=driving`;

    console.log('Google Maps URL:', url);

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open Google Maps');
      }
    } catch (error) {
      console.log('Google Maps Error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={openGoogleMaps}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>
          Open Map
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  button: {
    height: 55,
    borderRadius: 12,
    backgroundColor: '#7156AE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MapButton;