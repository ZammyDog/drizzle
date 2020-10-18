import images from './images';

// takes the hours and returns day or night
export const getDayNight = (hours) => {
  return hours > 7 && hours < 19 ? 'day' : 'night';
};

// takes the hours and return sunrise, sunset, day, or night
export const getDayStage = (hours) => {
  if (hours === 7) {
    return 'sunrise';
  }
  if (hours === 20) {
    return 'sunset';
  }
  return getDayNight(hours);
};

// returns one of our weather icon's names based on weather data
export const getWeatherName = (name, code) => {
  if (code > 700 && code < 800) {
    return 'Mist';
  }
  if (code === 801 && code === 802) {
    return 'Few Clouds';
  }
  return name;
};

// returns a random element from an array
export const randomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// gets an image based on the time and weather
export const getImage = (hours, weather) => {
  // get the stage of the day
  const dayStage = getDayStage(hours);
  // filter all images to only ones at the same day stage
  // and ones at the same weather
  const possibleImages = JSON.parse(JSON.stringify(images))
    .filter((i) => (i.time.includes(dayStage)))
    .filter((i) => (i.types.includes(weather)));
  // now get a randomElement from the possible images
  return randomElement(possibleImages);
};
