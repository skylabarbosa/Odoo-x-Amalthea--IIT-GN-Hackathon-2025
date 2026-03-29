const axios = require('axios');

const getCurrencyByCountry = async (countryName) => {
    try {
        const response = await axios.get(`https://restcountries.com/v3.1/name/${countryName}?fullText=true`);
        const countryData = response.data[0];
        if (countryData && countryData.currencies) {
            return Object.keys(countryData.currencies)[0];
        }
        return null;
    } catch (error) {
        console.error("Could not fetch currency for country:", countryName, error.message);
        return null;
    }
};

module.exports = { getCurrencyByCountry };