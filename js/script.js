"use strict";

import { apiConfig } from "../apiConfig.js";
Object.assign(apiConfig, {
  base_discover_url: 'https://api.themoviedb.org/3/discover/movie',
  base_search_url: 'https://api.themoviedb.org/3/search/movie',
  base_image_url: 'https://image.tmdb.org/t/p/w154'
});
import { fixedText, languages } from "./languages.js";

const randomPage = Math.floor(Math.random() * 40) + 1;

class DataService {
  static async getData(searchQuery, lang) {
    const { api_key, base_discover_url, base_search_url } = apiConfig;
    const base_url = searchQuery ? base_search_url : base_discover_url;
    const url = new URL(base_url);
    const sanitizedQuery = this.sanitizeQuery(searchQuery);

    url.searchParams.set('api_key', api_key);
    url.searchParams.set('language', lang);
    url.searchParams.set('include_adult', false);

    if (searchQuery) {
      url.searchParams.set('query', sanitizedQuery);
      url.searchParams.set('page', 1);
    } else {
      url.searchParams.set('vote_average.gte', 7);
      url.searchParams.set('vote_count.gte', 1000);
      url.searchParams.set('sort_by', 'vote_average.desc');
      url.searchParams.set('page', randomPage);
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      const responseData = await response.json();
      const data = responseData?.results;
      return data.filter(film => film.poster_path);
    } catch (error) {
      console.error(`Error fetching filmes for ${lang} and query ${searchQuery}:`, error);
    }
  }

  static sanitizeQuery(query, maxLength = 70) {
    let sanitized = query.trim();
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }
    sanitized = encodeURIComponent(sanitized);
    return sanitized;
  }
}

class LocalStorage {
  static getFavorites() {
    return JSON.parse(localStorage.getItem('favorites')) || {};
  }

  static updateFavorites(filmId, isFavorite) {
    const favorites = this.getFavorites();
    if (isFavorite) {
      delete favorites[filmId];
    } else {
      favorites[filmId] = true;
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    return favorites;
  }
}

const App = (() => {
  const langBtns = document.querySelectorAll('.nav-lang a');
  const searchInputEl = document.querySelector('.search-input');
  const resetBtn = document.querySelector('.reset-search-button');
  const searchBtn = document.querySelector('.search-button');
  const searchCheckbox = document.querySelector('#search-checkbox');
  const noResultsMessageEl = document.querySelector('.no-results-message');
  const filmsListEl = document.querySelector('.films-list');
  const pageTitleEl = document.querySelector('.page-title');
  const checkboxLabelEl = document.querySelector('.films-favorites-label>span');

  const favorites = LocalStorage.getFavorites();
  const dataByLanguage = {};
  const default_language = 'pt-BR';

  const init = async () => {
    try {
      renderDefaultPage(default_language);
      setupLanguageSwitch();
      setupEventListeners();
    } catch (error) {
      console.error('Error initializing the application:', error);
    }
  };

  const renderDefaultPage = async (lang) => {
    try {
      const searchQuery = '';
      await getDataForAllLanguages(searchQuery);
      renderPage(lang);
    } catch (error) {
      console.error('Error rendering the default page:', error);
    }
  };

  const getDataForAllLanguages = async (searchQuery) => {
    await Promise.all(languages.map(lang => getDataForLanguage(searchQuery, lang)));
  };

  const getDataForLanguage = async (searchQuery, lang) => {
    const data = await DataService.getData(searchQuery, lang);
    dataByLanguage[lang] = data;
    return data;
  };

  const getSelectedLanguage = () => {
    const activeLangEl = document.querySelector('.nav-lang a.active');
    if (activeLangEl) {
      return activeLangEl.dataset.lang;
    }
    return default_language;
  };

  const renderPage = (lang) => {
    translateFixedText(lang);
    updateLanguageButtons(lang);
    renderSearchResult(dataByLanguage[lang], lang);
    addCheckboxChangeListener(dataByLanguage[lang], lang);
  };

  const translateFixedText = (lang) => {
    const { title, inputPlaceholder, checkboxLabel, noResultsMessage } = fixedText[lang];
    pageTitleEl.textContent = title;
    searchInputEl.setAttribute('placeholder', inputPlaceholder);
    checkboxLabelEl.textContent = checkboxLabel;
    noResultsMessageEl.textContent = noResultsMessage;
  };

  const updateLanguageButtons = (lang) => {
    langBtns.forEach(link => link.classList.remove('active'));
    const selectedLangBtn = document.querySelector(`.nav-lang a[data-lang="${lang}"]`);
    if (selectedLangBtn) selectedLangBtn.classList.add('active');
  }

  const addCheckboxChangeListener = (data, lang) => {
    searchCheckbox.addEventListener('change', () => handleCheckboxChange(data, lang));
  };

  const handleCheckboxChange = (data, lang) => {
    const filteredFilms = filterFilmsByCheckbox(data);
    renderSearchResult(filteredFilms, lang);
  };

  const filterFilmsByCheckbox = (data) => {
    return searchCheckbox.checked ? data.filter(film => favorites[film.id]) : data;
  };

  const renderSearchResult = (data, lang) => {
    filmsListEl.innerHTML = '';
    if (data && data.length > 0) {
      renderFilms(data, lang);
      hideNoResultsMessage();
    } else {
      showNoResultsMessage();
    }
  };

  const hideNoResultsMessage = () => {
    noResultsMessageEl.className = 'no-results-message';
  };

  const showNoResultsMessage = () => {
    noResultsMessageEl.className = 'no-results-message show';
  };

  const renderFilms = (data, lang) => {
    const filteredFilms = filterFilmsByCheckbox(data);
    filteredFilms.forEach(film => {
      const li = createFilmCard(film, lang);
      filmsListEl.appendChild(li);
    });
  };

  const createFilmCard = (film, lang) => {
    const { id, poster_path, title, release_date, vote_average, overview } = film;
    const { base_image_url } = apiConfig;
    let isFavorite = favorites[id] ? true : false;

    const posterUrl = base_image_url + poster_path;
    const release_year = release_date ? release_date.split('-')[0] : 'N/A';

    const li = addEl('li');
    const filmIconEl = addEl('img', { class: 'film-icon', src: posterUrl, alt: title });
    const filmTitleEl = addEl('h2', { class: 'film-title' }, `${title} (${release_year})`);

    li.append(filmIconEl, filmTitleEl);

    const formattedVoteAverage = vote_average.toFixed(1).replace(/\.0$/, '');
    const filmRatingEl = addEl('p', { class: 'film-rating' }, formattedVoteAverage);
    const addToFavoritesEl = isFavorite
      ? addEl('button', { class: 'film-favorite is-favorite', 'data-id': id }, fixedText[lang].addToFavorites)
      : addEl('button', { class: 'film-favorite', 'data-id': id }, fixedText[lang].addToFavorites);
    const filmTextEl = addEl('p', { class: 'film-description' }, overview);

    li.append(filmRatingEl, addToFavoritesEl, filmTextEl);

    addToFavoritesEl.addEventListener('click', handleFavoriteButtonClick);

    return li;
  };

  const addEl = (tag, attr, text) => {
    const el = document.createElement(tag);
    if (attr) {
      for (const [key, value] of Object.entries(attr)) {
        el.setAttribute(key, value);
      }
    }
    if (text) {
      el.textContent = text;
    }
    return el;
  };

  const setupLanguageSwitch = async () => {
    langBtns.forEach(link => {
      link.addEventListener('click', async function (event) {
        event.preventDefault();
        const selectedLanguage = this.dataset.lang;
        if (!dataByLanguage[selectedLanguage]) {
          await getDataForLanguage(searchQuery, selectedLanguage);
        }
        renderPage(selectedLanguage);
      });
    });
  };

  const setupEventListeners = () => {
    searchBtn.addEventListener('click', handleFormSubmit);
    resetBtn.addEventListener('click', handleFormReset);
    document.querySelectorAll('.film-favorite').forEach(button => {
      button.addEventListener('click', handleFavoriteButtonClick);
    });
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const searchQuery = searchInputEl.value;
    const selectedLang = getSelectedLanguage();
    if (!searchQuery) {
      renderDefaultPage(selectedLanguage);
      return;
    }
    try {
      await getDataForAllLanguages(searchQuery);
      renderPage(selectedLang);
    } catch (error) {
      console.error('Error during search:', error);
    }
  };

  const handleFormReset = async (event) => {
    event.preventDefault();
    searchInputEl.value = '';
    const selectedLang = getSelectedLanguage();
    renderDefaultPage(selectedLang);
  }

  const handleFavoriteButtonClick = (event) => {
    const filmId = event.target.dataset.id;
    favorites[filmId] ? delete favorites[filmId] : favorites[filmId] = true;
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateUIButton(event.target, favorites[filmId]);
  }

  const updateUIButton = (button, isFavorite) => {
    if (isFavorite) {
      button.classList.add('is-favorite');
    } else {
      button.classList.remove('is-favorite');
    }
  }

  return {
    init
  };
})();

await App.init();