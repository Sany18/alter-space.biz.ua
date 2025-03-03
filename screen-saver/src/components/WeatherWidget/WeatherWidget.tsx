import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WeatherWidget.scss';
import localStorageService from '../../services/localStorageService/localStorageService';
import { capitalize, showSign } from '../../services/string/string.service';

const fetchWeatherEvery = 20 * 60 * 1000; // Update weather every 20 minutes

const WeatherWidget: React.FC = () => {
  const [city, setCity] = useState<string | null>('');
  const [weather, setWeather] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY; // Updated to match your env variable

  // Load the last searched city from localStorage on mount
  useEffect(() => {
    const savedCity = localStorageService.getItem<string>('lastCity');
    const lastWeather = localStorageService.getItem<any>('lastWeather');

    setCity(savedCity);
    setWeather(lastWeather);

    console.log(lastWeather);

    if (savedCity && lastWeather && checkDateTime(lastWeather.dt)) {
      fetchWeather(savedCity); // Auto-fetch weather for the saved city
    }
  }, []);

  // Update weather every 20 minutes
  useEffect(() => {
    if (city) {
      const interval = setInterval(() => {
        fetchWeather(city);
      }, fetchWeatherEvery);
      return () => clearInterval(interval);
    }
  }, [city]);

  const checkDateTime = (timestamp: number) => {
    const now = new Date();
    const lastUpdate = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
    const diff = Math.abs(now.getTime() - lastUpdate.getTime());

    return diff >= fetchWeatherEvery; // Return true if 20 minutes or more have passed
  }

  const fetchWeather = async (cityName: string) => {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`
      );

      setWeather(response.data);
      setError(null);
      localStorageService.setItem('lastCity', cityName);
      localStorageService.setItem('lastWeather', response.data);
    } catch (err) {
      setError('City not found or API error');
      setWeather(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (city?.trim()) fetchWeather(city);
  };

  return (
    <div className="weather-widget">
      <h2>Weather Widget</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={city || ''}
          placeholder="Enter city name"
          onChange={(e) => setCity(e.target.value)}
        />
        <button type="submit">Get Weather</button>
      </form>

      {error && <p className="error">{error}</p>}

      {weather && (
        <div className="weather-info">
          <div className='part left'>
            <h3>{weather.name}, {weather.sys.country}</h3>

            <p>{capitalize(weather.weather[0].description)}</p>
            <p>{showSign(weather.main.temp)} {weather.main.temp}°C</p>
            <p>Humidity: {weather.main.humidity}%</p>

          </div>

          <div className='part right'>
            <p>Wind: {weather.wind.speed} m/s</p>

            <img
              src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
              alt="Weather icon"
            />

            <p>Sunrise at {new Date(weather.sys.sunrise * 1000).toLocaleTimeString([], {hour12: false})}</p>

            <p>Sunset at {new Date(weather.sys.sunset * 1000).toLocaleTimeString([], {hour12: false})}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
