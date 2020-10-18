import React from 'react';
import classNames from 'classnames';
import axios from 'axios';
import moment from 'moment';

import styles from './arts.module.css';
import weatherIcons from './tools/weatherIcons';
import { getDayNight, getWeatherName, getImage } from './tools/helpers';
import { randomChange, changeMasterVolume, changeMasterBpm } from './components/LoFi/script';

const VOLUME_SCALE_DOWN = 150;
// how often to refresh weather (in seconds)
const REFRESH_CD = 60;
// how often to change image on refresh (every X refreshes)
const CHANGE_IMAGE_CD = 2;
// how often to change the beat maybe
const CHANGE_LOFI_CD = 20;

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
      volume: 50,
      bpm: 80,
    };

    changeMasterVolume(this.state.volume / VOLUME_SCALE_DOWN);
    changeMasterBpm(this.state.bpm);

    this.refreshCounter = REFRESH_CD;
    this.changeImageCounter = CHANGE_IMAGE_CD;
    this.changeLofiCounter = CHANGE_LOFI_CD;

    this.getWeather = this.getWeather.bind(this);
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
        // refresh the weather if its time, otherwise just update the time
        this.refreshCounter -= 1;
        if (this.refreshCounter <= 0) {
          this.changeImageCounter -= 1;
          this.refreshCounter = REFRESH_CD;
          this.getWeather(this.changeImageCounter <= 0);
        } else {
          const timeData = moment();
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
  }

  getWeather(changeImage, cb) {
    // get out current coordinates
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = pos.coords;
      // get the weather at our coordinates
      axios.get(`https://api.openweathermap.org/data/2.5/onecall?lat=${coords.latitude}&lon=${coords.longitude}&units=imperial&exclude=alerts&appid=${process.env.REACT_APP_OPEN_WEATHER_MAP_KEY}`)
        .then((response) => {
          console.log(response.data);
          const weather = response.data.current.weather[0];
          const nextWeather = response.data.daily[0].temp;
          const weatherName = getWeatherName(weather.main, weather.id);
          if (this.changeImage) {
            this.changeImageCounter = CHANGE_IMAGE_CD;
          }
          // update our ui with the weather and time
          this.setState({
            ready: true,
            time: moment().format('h:mm'),
            timeAdd: moment().format('a'),
            dateStr: moment().format('dddd, MMMM Do, YYYY'),
            temperature: Math.round(response.data.current.temp),
            weatherIcon: weatherIcons[getDayNight(moment().hours())][weatherName],
            hiLoStr: `${Math.round(nextWeather.min)}°/${Math.round(nextWeather.max)}°`,
            image: changeImage ? getImage(moment().hours(), weatherName) : this.state.image,
            hourly: response.data.hourly.slice(1, 7).map((t, i) => ({
              temp: Math.round(t.temp),
              time: moment().add(i + 1, 'hours').format('h'),
              timeAdd: moment().add(i + 1, 'hours').format('a'),
              icon: weatherIcons[getDayNight((moment().hours() + i + 1) % 24)][t.weather[0].main],
            })),
          }, () => {
            if (cb) cb();
          });
        })
        .catch((err) => console.error(err));
    });
  }

  render() {
    return (
      <div className={styles.regularBody} style={{ backgroundImage: this.state.image ? `url(${this.state.image.link})` : null }}>
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
                max="100"
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

            <i className={classNames('fas fa-cog', styles.settingsIcon)} aria-label="Settings" role="button" tabIndex={0} onClick={() => {}} />
          </>
        ) : null}
      </div>
    );
  }
}

export default App;
