export const getDayNight = (hours) => {
  return hours > 7 && hours < 19 ? 'day' : 'night';
};

export const getWeatherName = (name, code) => {
  if (code > 700 && code < 800) {
    return 'Mist';
  }
  if (code === 801 && code === 802) {
    return 'Few Clouds';
  }
  return name;
};
