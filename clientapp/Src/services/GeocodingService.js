const GOOGLE_MAPS_API_KEY = "AIzaSyDUgrmq9CuX0qgx2TQhrpycUd0MzwxJBX8";

const GeocodingService = {
  async getAddress(latitude, longitude) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `latlng=${latitude},${longitude}` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);

      const data = await response.json();

      console.log("GEOCODING RESPONSE:", data);

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        console.log("Geocoding failed:", data.status);

        return null;
      }

      const result = data.results[0];

      let address = "";
      let city = "";
      let state = "";
      let country = "";
      let postalCode = "";

      result.address_components.forEach((component) => {
        const types = component.types;

        if (types.includes("street_number")) {
          address += component.long_name + " ";
        }

        if (types.includes("route")) {
          address += component.long_name;
        }

        if (types.includes("locality")) {
          city = component.long_name;
        }

        if (types.includes("administrative_area_level_1")) {
          state = component.long_name;
        }

        if (types.includes("country")) {
          country = component.long_name;
        }

        if (types.includes("postal_code")) {
          postalCode = component.long_name;
        }
      });

      return {
        formattedAddress: result.formatted_address,

        address: address.trim(),

        city,

        state,

        country,

        postalCode,

        latitude,

        longitude,
      };
    } catch (error) {
      console.log("GEOCODING ERROR:", error);

      return null;
    }
  },
};

export default GeocodingService;
