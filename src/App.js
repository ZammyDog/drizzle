import React from 'react';
import classNames from 'classnames';
import axios from 'axios';
import moment from 'moment-timezone';

import styles from './arts.module.css';
import weatherIcons from './tools/weatherIcons';
import notify from './assets/notify.wav';
import { getDayNight, getWeatherName, getImage } from './tools/helpers';
import { randomChange, changeMasterVolume, changeMasterBpm } from './components/LoFi/script';

const VOLUME_SCALE_DOWN = 75;
// how often to refresh weather (in seconds)
const REFRESH_CD = 60;
// how often to change image on refresh (every X refreshes)
const CHANGE_IMAGE_CD = 2;
// how often to change the beat maybe
const CHANGE_LOFI_CD = 20;
// look away for 20 sec every 20 min
// TODO: fix this
const TWENTY_MINUTES = 40;
const TWENTY_MINUTES_DURATION = 30;

const openLink = (url) => {
  window.require('electron').shell.openExternal(url);
};

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      ready: false,
      temperature: 0,
      time: '',
      timeAdd: '',
      dateStr: '',
      weatherIcon: '',
      hiLoStr: '',
      image: '',
      hourly: [],
      showTime: true,
      showTemperature: true,
      showHourly: true,
      volume: 25,
      bpm: 80,
      showSettings: false,
      coords: {},
      cityText: '',
      timezone: '',
      twentySec: 0,
      noTwentySec: false,
    };

    changeMasterVolume(this.state.volume / VOLUME_SCALE_DOWN);
    changeMasterBpm(this.state.bpm);

    this.audio = new Audio(notify);
    this.audio.volume = 0.4;

    this.refreshCounter = REFRESH_CD;
    this.changeImageCounter = CHANGE_IMAGE_CD;
    this.changeLofiCounter = CHANGE_LOFI_CD;
    this.twentyCounter = TWENTY_MINUTES;

    this.getWeather = this.getWeather.bind(this);
    this.getCity = this.getCity.bind(this);
    this.lookAway = this.lookAway.bind(this);
  }

  componentDidMount() {
    this.getWeather(true, () => {
      // potentially update the time every second (so we don't miss a minute)
      this.timeInterval = setInterval(() => {
        // change the lofi every so often
        this.changeLofiCounter -= 1;
        if (this.changeLofiCounter) {
          this.refreshCounter = CHANGE_LOFI_CD;
          randomChange();
        }
        // look away from your screen for 20 sec every 20 min
        if (!this.state.noTwentySec) {
          this.twentyCounter -= 1;
          if (this.twentyCounter === 0) {
            this.twentyCounter = TWENTY_MINUTES + TWENTY_MINUTES_DURATION;
            this.lookAway();
          }
        }
        // refresh the weather if its time, otherwise just update the time
        this.refreshCounter -= 1;
        if (this.refreshCounter <= 0) {
          this.changeImageCounter -= 1;
          this.refreshCounter = REFRESH_CD;
          this.getWeather(this.changeImageCounter <= 0);
        } else {
          const timeData = moment().tz(this.state.timezone);
          this.setState({
            time: timeData.format('h:mm'),
            timeAdd: timeData.format('a'),
            dateStr: timeData.format('dddd, MMMM Do, YYYY'),
          });
        }
      }, 1000);
    });
  }

  componentWillUnmount() {
    clearInterval(this.timeInterval);
    clearInterval(this.lookInterval);
  }

  getWeather(changeImage, cb) {
    // get out current coordinates
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = this.state.coords.longitude !== undefined ? this.state.coords : pos.coords;
      // get the weather at our coordinates
      axios.get(`https://api.openweathermap.org/data/2.5/onecall?lat=${coords.latitude}&lon=${coords.longitude}&units=imperial&exclude=alerts&appid=${process.env.REACT_APP_OPEN_WEATHER_MAP_KEY}`)
        .then((response) => {
          // console.log(response.data);
          const weather = response.data.current.weather[0];
          const nextWeather = response.data.daily[0].temp;
          const weatherName = getWeatherName(weather.main, weather.id);
          const timezone = response.data.timezone;
          if (this.changeImage) {
            this.changeImageCounter = CHANGE_IMAGE_CD;
          }
          // update our ui with the weather and time
          this.setState({
            ready: true,
            timezone,
            time: moment().tz(timezone).format('h:mm'),
            timeAdd: moment().tz(timezone).format('a'),
            dateStr: moment().tz(timezone).format('dddd, MMMM Do, YYYY'),
            temperature: Math.round(response.data.current.temp),
            weatherIcon: weatherIcons[getDayNight(moment().tz(timezone).hours())][weatherName],
            hiLoStr: `${Math.round(nextWeather.min)}°/${Math.round(nextWeather.max)}°`,
            image: changeImage ? getImage(moment().tz(timezone).hours(), weatherName) : this.state.image,
            hourly: response.data.hourly.slice(1, 7).map((t, i) => ({
              temp: Math.round(t.temp),
              time: moment().tz(timezone).add(i + 1, 'hours').format('h'),
              timeAdd: moment().tz(timezone).add(i + 1, 'hours').format('a'),
              icon: weatherIcons[getDayNight(moment().tz(timezone).add(i + 1, 'hours').hours())][t.weather[0].main],
            })),
          }, () => {
            if (cb) cb();
          });
        })
        .catch((err) => console.error(err));
    });
  }

  getCity(e) {
    e.preventDefault();
    // reset the city to our coords if we search empty
    if (!this.state.cityText) {
      this.setState({ coords: {} }, () => this.getWeather(true));
      return;
    }

    // use openweathermap to get the city's coords and then get their weather forecast (not efficient, but meh)
    axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${this.state.cityText}&units=imperial&appid=${process.env.REACT_APP_OPEN_WEATHER_MAP_KEY}`)
      .then((response) => {
        this.setState({
          coords: {
            latitude: response.data.coord.lat,
            longitude: response.data.coord.lon,
          },
          cityText: '',
        }, () => this.getWeather(true));
      })
      .catch((err) => console.error(err));
  }

  lookAway() {
    // play a notification sound
    this.audio.play();
    // now start the interval to go through this
    let timer = TWENTY_MINUTES_DURATION;
    this.setState({
      twentySec: timer,
    }, () => {
      this.lookInterval = setInterval(() => {
        timer -= 1;
        this.setState({ twentySec: timer });
        if (timer <= 0) {
          this.audio.play();
          clearInterval(this.lookInterval);
        }
      }, 1000);
    });
  }

  render() {
    return (
      <div className={styles.regularBody} style={{ backgroundImage: this.state.image ? `url(${this.state.image.link})` : null }} id="body">
        <div className={styles.titleBar}>
          <i className={classNames('fas fa-times', styles.closeIcon)} aria-label="Close" role="button" tabIndex={0} onClick={window.close} />
        </div>

        {this.state.ready ? (
          <>
            <div
              className={classNames(styles.time, styles.backgroundHover, { [styles.invisible]: !this.state.showTime })}
              role="button"
              tabIndex={0}
              onClick={() => this.setState({ showTime: !this.state.showTime })}
            >
              <div style={{ height: 86 }}>
                {this.state.time}
                <span style={{ fontSize: 24 }}>{this.state.timeAdd}</span>
              </div>
              <div className={styles.dateText}>
                {this.state.dateStr}
              </div>
            </div>

            <div className={styles.authorLink} role="button" tabIndex={0} onClick={() => openLink(this.state.image.authorLink)}>
              {`Image: ${this.state.image.author}`}
            </div>

            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="50"
                value={this.state.volume}
                onChange={(e) => this.setState({ volume: e.target.value }, () => changeMasterVolume(this.state.volume / VOLUME_SCALE_DOWN))}
                className={styles.slider}
              />
              <i className={classNames(styles.sliderIcon, 'fas fa-volume-up')} />
            </div>

            <div className={styles.sliderContainer} style={{ right: 10 }}>
              <input
                type="range"
                min="60"
                max="100"
                value={this.state.bpm}
                onChange={(e) => this.setState({ bpm: e.target.value }, () => changeMasterBpm(this.state.bpm))}
                className={styles.slider}
              />
              <i className={classNames(styles.sliderIcon, 'fas fa-fast-forward')} />
            </div>

            <div className={styles.weatherColumn}>
              <div
                className={classNames(styles.temperature, styles.backgroundHover, { [styles.invisible]: !this.state.showTemperature })}
                role="button"
                tabIndex={0}
                onClick={() => this.setState({ showTemperature: !this.state.showTemperature })}
              >
                {`${this.state.temperature}°`}
                <div className={styles.weatherRow}>
                  <img src={this.state.weatherIcon} alt="weather" className={styles.weatherIcon} draggable={false} />
                  {this.state.hiLoStr}
                </div>
              </div>

              <div
                className={classNames(styles.hourlyWeather, styles.backgroundHover, { [styles.invisible]: !this.state.showHourly })}
                role="button"
                tabIndex={0}
                onClick={() => this.setState({ showHourly: !this.state.showHourly })}
              >
                {this.state.hourly.map((t, i) => (
                  <div key={i} className={styles.hourlyBox}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 10 }}>{t.time}</span>
                      <span style={{ fontSize: 8 }}>{t.timeAdd}</span>
                    </div>
                    <img src={t.icon} alt="weather" className={styles.hourlyIcon} draggable={false} />
                    {`${t.temp}°`}
                  </div>
                ))}
              </div>
            </div>

            <i
              className={classNames('fas fa-cog', styles.settingsIcon)}
              aria-label="Settings"
              role="button"
              tabIndex={0}
              onClick={() => this.setState({ showSettings: !this.state.showSettings })}
            />

            <form onSubmit={this.getCity} className={classNames(styles.settingsContainer, { [styles.settingsVisible]: this.state.showSettings })}>
              change location
              <div className={styles.inputRow}>
                <input
                  className={styles.textInput}
                  placeholder="city name"
                  onChange={(e) => this.setState({ cityText: e.target.value })}
                  type="text"
                  value={this.state.cityText}
                />

                <i
                  className={classNames('fas fa-search', styles.searchIcon)}
                  aria-label="Get City"
                  role="button"
                  tabIndex={0}
                  onClick={this.getCity}
                />
              </div>

              <br />

              <div className={styles.inputRow}>
                <input type="checkbox" className={styles.checkbox} checked={this.state.noTwentySec} onChange={() => this.setState({ noTwentySec: !this.state.noTwentySec })} />
                block 20 second breaks
              </div>
            </form>

            {this.state.twentySec > 0 ? (
              <div className={styles.twentyPopUp}>
                <i className={classNames(styles.eyeIcon, 'fas fa-eye')} />
                {this.state.twentySec <= 20
                  ? 'Keep looking away at an object 20 feet away for 20 seconds!' : "That's 20 minutes, get ready to look at something 20 feet away for 20 seconds!"}
                <br />
                <br />
                {this.state.twentySec % 21}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }
}

export default App;
