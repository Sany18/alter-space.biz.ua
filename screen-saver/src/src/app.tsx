import { useEffect, useState } from 'react';
import TimeWidget from '../components/TimeWidget/TimeWidget'
import WeatherWidget from '../components/WeatherWidget/WeatherWidget'
import './app.scss'

function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return <>
      <div className='app'>
        <WeatherWidget />
        <TimeWidget />

        <button
          className='toggle-theme-button flat-button'
          onClick={toggleTheme}>
          Change theme to {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>
  </>
}

export default App;
