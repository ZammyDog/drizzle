# drizzle
Heyo! We built drizzle to provide a way to keep your mind at peace in a crazy world. drizzle uses a variety of instrumental samples and machine learning algorithms to generate calming Lo-Fi hip-hop music. It also provides beautiful images that match your time and weather, and offers a variety of customization to create the app that you need. 

drizzle will also help you follow the 20/20/20 rule of looking at something 20 feet away from your screen for 20 seconds every 20 minutes. This is really important to take care of your eyes, especially when your doing something like a 24 (25) hour hackathon. Oh yeah, and drizzle was built remotely during HackNC 2020.

## What exactly is this?
drizzle is an [electron.js](https://www.electronjs.org/) desktop application that is combined with [create-react-app.](https://github.com/facebook/create-react-app) We used React for all of our front-end and got all of our weather data from the [OpenWeatherMap API](https://openweathermap.org/api).

drizzle's Lo-Fi music generation is based off of [this amazing repo](https://github.com/magenta/lofi-player) and uses [magenta.js](https://github.com/magenta/magenta-js) to get TensorFlow algorithms that generate some of the melodies. We completely reworked much of the Lo-Fi player repo to work with React and to be able to customize it with our own UI. Most of the sound samples used are from [this rad repo](https://github.com/nbrosowsky/tonejs-instruments).

We also used [moment.js](https://momentjs.com/) to deal with all of our time management and manipulation. All of the styling was written from scratch with CSS, as well as all components with React JSX. 

## Can I run it?
Heck yeah! There are a few things you need to know though. First make sure you download all of the necessary dependencies (`npm i`). Then, set the environment variable `BROWSER=none` and `SKIP_PREFLIGHT_CHECK=true`. You'll also need to set the environment variables `GOOGLE_API_KEY` to a valid key that provides geolocation services and `REACT_APP_OPEN_WEATHER_MAP_KEY`, to a valid key from OpenWeatherMap. You'll also need to install `foreman` so you can fun the following command. Then, just type `npm start` and you should be good to go! Ok, so maybe it's not that easy but we were a little tight for time, you get it.

#### ALSO IMPORTANT, WORDS THAT RHYME WITH DRIZZLE:
sizzle, swizzle, shizzle, chisel, fizzle, ms. frizzle, grizzle, etc.

