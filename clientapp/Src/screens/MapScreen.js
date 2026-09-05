import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Map,
  Camera,
  GeoJSONSource,
  Layer,
  Marker,
} from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';
import MapButton from './MapButton';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Overview zoom level matching screenshot
const INITIAL_ZOOM = 12.3;

// ---------- Fetch Real Road Route via OSRM Router ----------
async function fetchRoadRouteOSRM(originLngLat, destLngLat) {
  if (!originLngLat || !destLngLat) return null;

  try {
    const [origLng, origLat] = originLngLat;
    const [destLng, destLat] = destLngLat;

    const url = `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates; // Array of [lng, lat]
      if (coords && coords.length > 1) {
        console.log(
          '🛣️ [OSRM ROAD ROUTE] Coordinates fetched:',
          coords.length,
          'points',
        );
        return coords;
      }
    }
  } catch (err) {
    console.log('OSRM routing notice:', err?.message || err);
  }

  // Fallback checkpoints if offline
  return [
    originLngLat,
    [
      (originLngLat[0] * 2 + destLngLat[0]) / 3,
      (originLngLat[1] * 2 + destLngLat[1]) / 3,
    ],
    [
      (originLngLat[0] + destLngLat[0] * 2) / 3,
      (originLngLat[1] + destLngLat[1] * 2) / 3,
    ],
    destLngLat,
  ];
}

const TrackOrderScreen = ({ route, navigation }) => {
  const {
    customerId = 'customer_101',
    driverId = 'driver_201',
    driverName = 'Arun',
    destinationTitle = 'Gatot Subroto Street 8129',
    bookingNumber = 'AB321481251245612',
    originCity = 'Minnesota, USA',
    destinationCity = 'New York, USA',
    createdDate = 'June 4, 2025',
  } = (route && route.params) || {};

  const cameraRef = useRef(null);
  const isInitialCameraSetRef = useRef(false);

  // 1. FIXED Customer Home Location [longitude, latitude] (Does NOT move)
  const [homeLocation, setHomeLocation] = useState([79.8083, 11.9416]);

  // 2. MOVING Driver Car Location [longitude, latitude] (Moves along route towards Home)
  const [carLocation, setCarLocation] = useState([79.825, 11.975]);

  // 3. Road Route Coordinates [[lng, lat], [lng, lat], ...]
  const [routeCoordinates, setRouteCoordinates] = useState([
    [79.825, 11.975],
    [79.8083, 11.9416],
  ]);

  const routePointsRef = useRef([]);
  const stepIndexRef = useRef(0);

  // Request Location Permission on Android
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'App needs your location to set as Home destination.',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (e) {
        return false;
      }
    }
    return true;
  };

  // Generate Road Route from Driver starting point (~3.5km away) to Fixed Home
  const generateRoadRoute = useCallback(async fixedHomeLngLat => {
    try {
      const driverStart = [
        fixedHomeLngLat[0] + 0.018,
        fixedHomeLngLat[1] + 0.032,
      ];

      // Initial car starting position at 3.5km away
      setCarLocation(driverStart);

      console.log(
        '📍 [MAP] Generating road route from Driver -> Home:',
        driverStart,
        '->',
        fixedHomeLngLat,
      );
      const roadCoords = await fetchRoadRouteOSRM(driverStart, fixedHomeLngLat);

      if (roadCoords && roadCoords.length > 1) {
        setRouteCoordinates(roadCoords);
        routePointsRef.current = roadCoords;
        stepIndexRef.current = 0;

        const centerLng = (driverStart[0] + fixedHomeLngLat[0]) / 2;
        const centerLat = (driverStart[1] + fixedHomeLngLat[1]) / 2;

        // Auto-zoom once at the start using MapLibre flyTo API
        if (!isInitialCameraSetRef.current && cameraRef.current) {
          isInitialCameraSetRef.current = true;
          cameraRef.current.flyTo({
            center: [centerLng, centerLat],
            zoom: INITIAL_ZOOM,
            duration: 1000,
          });
        }
      }
    } catch (err) {
      console.log('Road route generation error:', err);
    }
  }, []);

  // Fetch Home GPS ONCE on start (Home stays strictly stationary)
  useEffect(() => {
    let isMounted = true;

    const initLocation = async () => {
      try {
        const hasPerm = await requestLocationPermission();
        if (hasPerm) {
          Geolocation.getCurrentPosition(
            pos => {
              if (isMounted && pos?.coords) {
                const { latitude, longitude } = pos.coords;
                const fixedHome = [longitude, latitude];
                console.log('🏠 [FIXED HOME GPS SET]:', fixedHome);
                setHomeLocation(fixedHome);
                generateRoadRoute(fixedHome);
              }
            },
            err => {
              if (isMounted) {
                console.log(
                  'Geolocation error, using default home:',
                  err?.message,
                );
                generateRoadRoute(homeLocation);
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
          );
        } else if (isMounted) {
          generateRoadRoute(homeLocation);
        }
      } catch (e) {
        if (isMounted) {
          console.log('Init location error:', e);
          generateRoadRoute(homeLocation);
        }
      }
    };

    initLocation();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 10-Second Continuous CAR-ONLY Movement along Road Route (Home remains stationary)
  useEffect(() => {
    const interval = setInterval(() => {
      const pts = routePointsRef.current;
      if (!pts || pts.length <= 1) return;

      let nextIndex = stepIndexRef.current + 1;

      // When car reaches Home (end of route), loop back to the 3km start point
      if (nextIndex >= pts.length) {
        console.log(
          '🚗 [CAR ARRIVED AT HOME] -> Restarting from 3km start point',
        );
        nextIndex = 0;
      }

      stepIndexRef.current = nextIndex;
      const nextCarPos = pts[nextIndex];

      console.log(
        `🚗 [CAR ONLY MOVING] Step ${nextIndex + 1}/${pts.length}:`,
        nextCarPos,
      );
      setCarLocation(nextCarPos);
    }, 10000); // 10 seconds interval

    return () => clearInterval(interval);
  }, []);

  // Manual Recenter Camera (when user clicks the compass button)
  const recenterMap = () => {
    try {
      if (cameraRef.current) {
        cameraRef.current.flyTo({
          center: [
            (carLocation[0] + homeLocation[0]) / 2,
            (carLocation[1] + homeLocation[1]) / 2,
          ],
          zoom: INITIAL_ZOOM,
          duration: 800,
        });
      }
    } catch (e) {
      console.log('Recenter error:', e);
    }
  };

  const openChat = () => {
    if (navigation?.navigate) {
      navigation.navigate('CustomerChat', {
        userId: customerId,
        receiverId: driverId,
        receiverName: driverName,
      });
    }
  };

  const openCall = () => {
    if (navigation?.navigate) {
      navigation.navigate('CustomerCallScreen', {
        userId: customerId,
        receiverId: driverId,
        receiverName: driverName,
      });
    }
  };

  const routeGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {/* ================= MAP SECTION (Top 325px) ================= */}
        <View style={styles.mapContainer}>
          <Map
            style={styles.map}
            mapStyle={MAP_STYLE_URL}
            logo={false}
            attribution={false}
          >
            {/* initialViewState sets the starting zoom and center position immediately */}
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: [
                  (carLocation[0] + homeLocation[0]) / 2,
                  (carLocation[1] + homeLocation[1]) / 2,
                ],
                zoom: INITIAL_ZOOM,
              }}
            />

            {/* ROUTE LINE — black, thick, rounded joins/caps following roads */}
            <GeoJSONSource id="routeSource" data={routeGeoJSON}>
              <Layer
                id="routeLine"
                type="line"
                paint={{
                  'line-color': '#111111',
                  'line-width': 4,
                  'line-join': 'round',
                  'line-cap': 'round',
                }}
              />
            </GeoJSONSource>

            {/* 🏠 STATIONARY HOME MARKER (Fixed Destination) */}
            <Marker id="home-marker" lngLat={homeLocation}>
              <View style={styles.blackMarker}>
                <Text style={styles.markerIcon}>⌂</Text>
              </View>
            </Marker>

            {/* 🚗 MOVING CAR MARKER (Moves every 10s along road & restarts from 3km away) */}
            <Marker id="car-marker" lngLat={carLocation}>
              <View style={styles.blackMarker}>
                <Text style={styles.markerIcon}>🚗</Text>
              </View>
            </Marker>
          </Map>

          {/* ================= MAP HEADER ================= */}
          <View style={styles.mapHeader} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => navigation?.goBack?.()}
              activeOpacity={0.8}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.helpPill}
                onPress={() =>
                  Alert.alert(
                    'Support Helpline',
                    'Dispatch Helpline: +91 1800 123 4567',
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.helpText}>Help</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.compassButton}
                onPress={recenterMap}
                activeOpacity={0.8}
              >
                <Text style={styles.compassIcon}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ================= BOTTOM DETAILS ================= */}
        <ScrollView
          style={styles.bottomContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ================= DELIVERY CARD ================= */}
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliveryTitle}>{destinationTitle}</Text>
              <Text style={styles.deliverySubtitle}>
                Warehouse Pickup • 12 min Estimated
              </Text>
            </View>

            <TouchableOpacity
              style={styles.deliveryArrow}
              onPress={recenterMap}
              activeOpacity={0.8}
            >
              <Text style={styles.deliveryArrowText}>➤</Text>
            </TouchableOpacity>
          </View>

          {/* ================= DRIVER CARD ================= */}
          <View style={styles.driverCard}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
              style={styles.driverImage}
            />

            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.driverRole}>Driver</Text>
            </View>

            <TouchableOpacity
              style={styles.driverButton}
              onPress={openChat}
              activeOpacity={0.8}
            >
              <Text style={styles.chatIcon}>💬</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.driverButton}
              onPress={openCall}
              activeOpacity={0.8}
            >
              <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>
          </View>

          {/* ================= REVIEW ORDER ================= */}
          <View style={styles.reviewContainer}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Review Order</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Order Info',
                    `Booking: ${bookingNumber}\nDriver: ${driverName}\nStatus: Live Tracking Active`,
                  )
                }
              >
                <Text style={styles.seeDetails}>See Details</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Booking Number</Text>
            <Text style={styles.bookingNumber}>{bookingNumber}</Text>

            <View style={styles.addressRow}>
              <View style={styles.addressColumn}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.addressText}>{originCity}</Text>
              </View>

              <View style={styles.addressColumn}>
                <Text style={styles.label}>To</Text>
                <Text style={styles.addressText}>{destinationCity}</Text>
              </View>

              <View style={styles.addressColumn}>
                <Text style={styles.label}>Created</Text>
                <Text style={styles.addressText}>{createdDate}</Text>
              </View>
            </View>
          </View>

          {/* ================= TRACKING ORDER ================= */}
          <View style={styles.trackingContainer}>
            <Text style={styles.trackingTitle}>Tracking Order</Text>

            {/* STEP 1 */}
            <View style={styles.stepRow}>
              <View style={styles.timelineColumn}>
                <View style={styles.activeDot} />
                <View style={styles.timelineLine} />
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Moving From O Tempora</Text>
                <Text style={styles.stepDate}>June 6, 2025 02:00 AM</Text>
              </View>
            </View>

            {/* STEP 2 */}
            <View style={styles.stepRow}>
              <View style={styles.timelineColumn}>
                <View style={styles.activeDot} />
              </View>

              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  In Transit to Warehouse Mason
                </Text>
                <Text style={styles.stepDate}>June 6, 2025 02:00 PM</Text>
              </View>

            </View>
              <MapButton homeLocation={homeLocation} carLocation={carLocation} />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default TrackOrderScreen;

/* ================================================= */
/* STYLES */
/* ================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  /* ================= MAP ================= */
  mapContainer: {
    height: 325,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  /* ================= HEADER ================= */
  mapHeader: {
    position: 'absolute',
    top: 15,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  closeIcon: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  helpPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#252525',
  },
  compassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  compassIcon: {
    fontSize: 15,
    color: '#315BC7',
    transform: [{ rotate: '45deg' }],
  },
  /* ================= MARKERS ================= */
  blackMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  markerIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  /* ================= BOTTOM ================= */
  bottomContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  /* ================= DELIVERY ================= */
  deliveryCard: {
    minHeight: 64,
    backgroundColor: '#315BC7',
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deliverySubtitle: {
    color: '#E3E8FF',
    fontSize: 10,
    marginTop: 3,
  },
  deliveryArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryArrowText: {
    color: '#315BC7',
    fontSize: 15,
  },
  /* ================= DRIVER ================= */
  driverCard: {
    height: 68,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  driverImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  driverInfo: {
    flex: 1,
    marginLeft: 10,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#252525',
  },
  driverRole: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  driverButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIcon: {
    fontSize: 18,
    color: '#333333',
  },
  callIcon: {
    fontSize: 18,
    color: '#333333',
  },
  /* ================= REVIEW ================= */
  reviewContainer: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#252525',
  },
  seeDetails: {
    fontSize: 9,
    color: '#5368C5',
  },
  label: {
    fontSize: 8,
    color: '#8A8A8A',
    marginTop: 7,
  },
  bookingNumber: {
    fontSize: 11,
    color: '#333333',
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  addressColumn: {
    flex: 1,
  },
  addressText: {
    fontSize: 9,
    color: '#333333',
    marginTop: 2,
  },
  /* ================= TRACKING ================= */
  trackingContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 30,
  },
  trackingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#252525',
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineColumn: {
    width: 18,
    alignItems: 'center',
  },
  activeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#315BC7',
    marginTop: 3,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#D6D6D6',
    marginTop: 3,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 3,
  },
  stepTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333333',
  },
  stepDate: {
    fontSize: 8,
    color: '#999999',
    marginTop: 3,
  },
});
