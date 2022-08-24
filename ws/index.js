import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import busboy from 'connect-busboy';
import busboyBodyParser from 'busboy-body-parser';
import dotenv from 'dotenv';

import './database.js';
dotenv.config();

import userRoutes from './src/routes/user.routes.js';
import challengeRoutes from './src/routes/challenge.routes.js';


const app = express();

app.use(morgan('dev'));
app.use(busboy());
app.use(busboyBodyParser());
app.use(express.json());
app.use(cors());

/*rotas*/
app.use('/user', userRoutes);
app.use('/challenge', challengeRoutes);

app.listen(8000, function (){
  console.log('Server is running on port 8000');
})
