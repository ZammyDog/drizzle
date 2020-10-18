import React from 'react';
import classNames from 'classnames';
import axios from 'axios';
import moment from 'moment';

import styles from './arts.module.css';
// import './components/LoFi/script';

const STARTER_BACKGROUND = 'https://res.cloudinary.com/dhzssvuhz/image/upload/v1602988324/drizzle/henrik-evensen-winter-forest_dyb1es.jpg';
const OPEN_WEATHER_MAP_API_KEY = 'abc60186fcef4077d4da248e9e804e3d';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      ready: false,
      temperature: 0,
      time: '',
      timeAdd: '',
      dateStr: '',
    };
  }

  componentDidMount() {
    // get out current coordinates
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = pos.coords;
      // get the weather at our coordinates
      axios.get(`https://api.openweathermap.org/data/2.5/onecall?lat=${coords.latitude}&lon=${coords.longitude}&units=imperial&exclude=alerts&appid=${OPEN_WEATHER_MAP_API_KEY}`)
        .then((response) => {
          // update our ui with the weather and time
          this.setState({
            ready: true,
            time: moment().format('h:mm'),
            timeAdd: moment().format('a'),
            dateStr: moment().format('dddd, MMMM Do, YYYY'),
            temperature: Math.round(response.data.current.temp),
          }, () => {
            // now potentially update the time every second (so we don't miss a minute)
            this.timeInterval = setInterval(() => {
              const timeData = moment();
              this.setState({
                time: timeData.format('h:mm'),
                timeAdd: timeData.format('a'),
                dateStr: timeData.format('dddd, MMMM Do, YYYY'),
              });
            }, 1000);
          });
        })
        .catch((err) => console.error(err));
    });
  }

  componentWillUnmount() {
    clearInterval(this.timeInterval);
  }

  render() {
    return (
      <div className={styles.regularBody} style={{ backgroundImage: `url(${STARTER_BACKGROUND})` }}>
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
            </div>
          </>
        ) : null}
      </div>
    );
  }
}

export default App;
