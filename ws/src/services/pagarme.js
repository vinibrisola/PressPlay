import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const api_key = process.env.API_KEY;

const api = axios.create({
  baseURL: 'https://api.pagar.me/1',
});

export default async (endpoint, data, method = 'post') => {
  try {
    const response = await api[method](endpoint, {
      api_key,
      ...data,
    });

    return { error: false, data: response.data };
  } catch (err) {
    return {
      error: true,
      message: JSON.stringify(err.response.data.errors[0]),
    };
  }
};
