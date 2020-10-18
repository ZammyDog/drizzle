import React from 'react';
import classNames from 'classnames';

import styles from './arts.module.css';
// import './components/LoFi/script';

const STARTER_BACKGROUND = 'https://res.cloudinary.com/dhzssvuhz/image/upload/v1602988324/drizzle/henrik-evensen-winter-forest_dyb1es.jpg';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  componentDidMount() {
    console.log(Navigator);
  }

  render() {
    return (
      <div className={styles.regularBody} style={{ backgroundImage: `url(${STARTER_BACKGROUND})` }}>
        <div className={styles.titleBar}>
          <i className={classNames('fas fa-times', styles.closeIcon)} aria-label="Close" role="button" tabIndex={0} onClick={window.close} />
        </div>
        <div className={styles.temp}>
          72°
        </div>
      </div>
    );
  }
}

export default App;
