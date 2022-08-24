import mongoose from 'mongoose';

import dotenv from 'dotenv';
dotenv.config();

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose
  .connect(process.env.URI)
  .then(() => console.log('DB is Up!'))
  .catch((err) => console.log(err));

