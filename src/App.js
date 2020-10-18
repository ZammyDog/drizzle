import React from 'react';
import classNames from 'classnames';
import axios from 'axios';
import moment from 'moment';

import styles from './arts.module.css';
import weatherIcons from './tools/weatherIcons';
import { getDayNight, getWeatherName, getImage } from './tools/helpers';
// import './components/LoFi/script';

const STARTER_BACKGROUND = 'https://res.cloudinary.com/dhzssvuhz/image/upload/v1602988324/drizzle/henrik-evensen-winter-forest_dyb1es.jpg';
// how often to refresh weather (in seconds)
const REFRESH_CD = 30;
// how often to change image on refresh (every X refreshes)
const CHANGE_IMAGE_CD = 4;

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
    };

    this.first = true;
    this.refreshCounter = REFRESH_CD;
    this.changeImageCounter = CHANGE_IMAGE_CD;

    this.getWeather = this.getWeather.bind(this);
  }

  componentDidMount() {
    this.getWeather(true, () => {
      // potentially update the time every second (so we don't miss a minute)
      this.timeInterval = setInterval(() => {
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
          }, cb ? () => cb() : () => {});
        })
        .catch((err) => console.error(err));
    });
  }

  render() {
    return (
      <div className={styles.regularBody} style={{ backgroundImage: `url(${this.state.image ? this.state.image.link : STARTER_BACKGROUND})` }}>
        <div className={styles.titleBar}>
          <i className={classNames('fas fa-times', styles.closeIcon)} aria-label="Close" role="button" tabIndex={0} onClick={window.close} />
        </div>

        {this.state.ready ? (
          <>
            <div className={styles.time}>
              <div style={{ height: 86 }}>
                {this.state.time}
                <span style={{ fontSize: 24 }}>{this.state.timeAdd}</span>
              </div>
              <div className={styles.dateText}>
                {this.state.dateStr}
              </div>
            </div>

            <div className={styles.temperature}>
              {`${this.state.temperature}°`}
              <div className={styles.weatherRow}>
                <img src={this.state.weatherIcon} alt="weather" className={styles.weatherIcon} draggable={false} />
                {this.state.hiLoStr}
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
