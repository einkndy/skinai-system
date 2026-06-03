const config = {

  // BACKEND LOCAL
  LOCAL_API_URL: "http://127.0.0.1:8000",

};

export const API_URL = import.meta.env.VITE_API_URL || config.LOCAL_API_URL;

export default config;
