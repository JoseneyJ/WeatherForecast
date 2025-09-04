/* === Config / state === */
const apiKey = 'afbc506061b9a4fcfb29957519d4b8de';
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

let city = '';
let cityArr = [];

/* === Utilities === */
function formatGeoQuery(input) {
  if (!input) return '';
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) {
    // If second part looks like a US state code (2 letters) assume US
    if (/^[A-Za-z]{2}$/.test(parts[1])) {
      return `${parts[0]},${parts[1]},US`;
    } else {
      return `${parts[0]},${parts[1]}`;
    }
  }
  // If user supplied city,state,country already or something else, join them
  return parts.join(',');
}

function showMsg(text) {
  const el = document.querySelector('.msg');
  if (el) el.innerHTML = text || '';
}

/* === Load saved history === */
window.onload = function () {
  console.log('onload');
  const saved = JSON.parse(localStorage.getItem('cities') || '[]');
  cityArr = Array.isArray(saved) ? saved : [];

  $('#history').empty();
  cityArr.forEach(x => {
    $('#history').prepend($(`<button class="btn btn-default citybtn" type="button">${x}</button>`));
  });
};

/* === Check duplicates (case-insensitive) === */
function checkItem(citytxt) {
  for (let i = 0; i < cityArr.length; i++) {
    if (cityArr[i].toLowerCase() === citytxt.toLowerCase()) return true;
  }
  return false;
}

/* === Search button handler === */
$('#searchbtn').on('click', function (event) {
  event.preventDefault();
  const inputVal = $('#inputVal');
  city = inputVal.val().trim();
  if (!city) {
    showMsg('Please enter a valid input.');
    return;
  }
  showMsg('');

  if (cityArr.length === 0 || !checkItem(city)) {
    cityArr.push(city);
    $('#history').prepend($(`<button class="btn btn-default citybtn" type="button">${city}</button>`));
    localStorage.setItem('cities', JSON.stringify(cityArr));
  }

  currentData();
});

/* === Main: get geo -> then weather -> then forecast === */
function currentData() {
  const query = formatGeoQuery(city);
  console.log('Geocode query:', query);

  $.ajax({
    url: GEO_URL,
    dataType: 'json',
    method: 'GET',
    data: { q: query, appid: apiKey, limit: 1 },
    success: function (geoData) {
      console.log('Geocode response:', geoData);
      if (!Array.isArray(geoData) || geoData.length === 0) {
        showMsg('Location not found. Try "Miami" or "Miami, FL" or "City, Country".');
        return;
      }

      const lat = geoData[0].lat;
      const lon = geoData[0].lon;

      // Use lat/lon for the weather request — more reliable than q when user input contains commas
      $.ajax({
        url: WEATHER_URL,
        dataType: 'json',
        method: 'GET',
        data: { lat: lat, lon: lon, appid: apiKey, units: 'metric' },
        success: function (weather) {
          console.log('Weather response:', weather);
          // Display city & date (use weather.name which is normalized)
          $('#city').text(weather.name + ' ' + moment().format('YYYY-MM-DD'));
          $('#temp').text('Temperature: ' + weather.main.temp + '°');
          $('#humidity').text('Humidity: ' + weather.main.humidity + '%');
          $('#wind').text('Wind: ' + weather.wind.speed + ' mph');
          $('#icon').attr('src', 'https://openweathermap.org/img/wn/' + weather.weather[0].icon + '.png');

          // Clear five-day placeholders
          for (let dayNum = 1; dayNum <= 5; dayNum++) {
            const dayEL = document.querySelector('#day-' + dayNum);
            if (dayEL) dayEL.innerHTML = '';
          }

          // Request 5-day forecast (by lat/lon)
          fivedayData(lat, lon);
        },
        error: function (xhr, status, err) {
          console.error('Weather AJAX error:', status, err);
          showMsg('Failed to fetch current weather — check console for details.');
        }
      });
    },
    error: function (xhr, status, err) {
      console.error('Geo AJAX error:', status, err);
      showMsg('Failed to geocode location — check console for details.');
    }
  });
}

/* === 5-day forecast: pick midday items when possible === */
function fivedayData(lat, lon) {
  $.ajax({
    url: FORECAST_URL,
    dataType: 'json',
    method: 'GET',
    data: { lat: lat, lon: lon, appid: apiKey, units: 'metric' },
    success: function (response) {
      console.log('Forecast response:', response);
      // Try to pick entries at 12:00:00 for each day
      const middayItems = response.list.filter(item => item.dt_txt.indexOf('12:00:00') !== -1);

      let picks = [];
      if (middayItems.length >= 5) {
        picks = middayItems.slice(0, 5);
      } else {
        // fallback: pick 5 items spaced ~24 hours apart (old behaviour)
        for (let i = 4; i < response.list.length && picks.length < 5; i += 8) {
          picks.push(response.list[i]);
        }
      }

      // Render picks
      let dayNum = 1;
      picks.forEach(item => {
        const shortDate = item.dt_txt.split(' ')[0];
        const $card = $('<div>').addClass('forecast-card');
        $card.append($('<h5>').text(shortDate));
        $card.append($('<img>').attr('src', 'https://openweathermap.org/img/wn/' + item.weather[0].icon + '.png'));
        $card.append($('<h6>').addClass('card-subtitle mb-2').text('Temperature: ' + item.main.temp + '°'));
        $card.append($('<h6>').text('Wind: ' + item.wind.speed + ' mph'));
        $card.append($('<h6>').text('Humidity: ' + item.main.humidity + '%'));

        $('#day-' + dayNum).append($card);
        dayNum++;
      });
    },
    error: function (xhr, status, err) {
      console.error('Forecast AJAX error:', status, err);
      showMsg('Failed to fetch forecast — check console for details.');
    }
  });
}

/* === Click history buttons === */
$(document).on('click', '.citybtn', function () {
  city = $(this).text();
  currentData();
});
