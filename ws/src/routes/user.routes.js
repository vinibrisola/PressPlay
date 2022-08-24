import express, { request } from 'express';
import mongoose from 'mongoose';
import Busboy from 'busboy';
import bcrypt from 'bcrypt';
import moment from 'moment';
import aws from '../services/aws.js';
import pagarme from '../services/pagarme.js';
import User from '../models/user.js';
import Challenge from '../models/challenge.js';
import UserChallenge from '../models/relationship/userChallenge.js';
import Tracking from '../models/tracking.js';

const router = express.Router();

router.post('/', async(req, res) => {
  var busboy = new Busboy({ headers: req.headers });
  busboy.on('finish', async () => {
    try{
      const userId = mongoose.Types.ObjectId();
      let photo = '';
      // UPLOAD DA IMAGE
      if (req.files){
        const file = req.files.photo;
        const nameParts = file.name.split('.');
        const fileName = `${userId}.${nameParts[nameParts.length - 1]}`;
        photo = `users/${fileName}`;
        const response = await aws.uploadToS3(file, photo);
        if(response.error){
          throw response.error;
        }
      }


      // CRIAR SENHA COM BCRYPT
      const password = await bcrypt.hash(req.body.password, 10);

      const user = await new User({
        ...req.body,
        _id: userId,
        password,
        photo,
      }).save();
      console.log(user);

     res.json({ user });

    }catch(err){
      res.json({error:true, message: err.message});
    }
  });
  req.pipe(busboy);
});

router.post('/login', async(req, res) => {
  try{
    const { email, password } = req.body;
    const user = await User.findOne({ email, status: 'A' });
    if(!user){
      throw new Error('Usuário não encontrado');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid){
      throw new Error('Combinação errada E-mail e senha');
    }

    res.json({ user });

  }catch(err){
    res.json({error:true, message: err.message});
  }
});

router.put('/:userId/accept', async(req, res) => {
  try{
    const {userId} = req.params;
    const user = await User.findById(userId);
    const pagarmeUser = await pagarme('/customers', {
      external_id: userId,
      name: user.name,
      type: 'individual',
      country: 'br',
      email: user.email,
      documents: [
        {
          type: 'cpf',
          number: user.cpf,
        },
      ],
      phone_numbers: ['+55' + user.phone],
      birthday: user.birthday,
    });

    if(pagarmeUser.error){
      throw pagarmeUser;
    }
    await User.findByIdAndUpdate(userId, {
      customerId: pagarmeUser.data.id,
      status: "A",
    });

    res.json({ message: 'Usuário aceito na plataforma' });
  }catch(err){
    res.json({error:true, message: err.message});
  }
});

router.get('/:userId/challenge', async(req, res) => {
  try{
    const {userId} = req.params;
    const challenge = await Challenge.findOne({
      status: 'A'
    });
    if(!challenge){
      throw new Error('Nenhum desafio ativo');
    }
    const userChallenge = await UserChallenge.findOne({
      userId,
      challengeId: challenge._id
    })
    const dayStart = moment(challenge.date.start, 'YYYY-MM-DD');
    const dayEnd = moment(challenge.date.end, 'YYYY-MM-DD');
    const challengePeriod = dayEnd.diff(dayStart, 'days');
    const currentPeriod = moment().diff(dayStart.subtract(1,'day'), 'days');

    const dailyAmount = challenge.fee / challengePeriod;


    const participatedTimes = await Tracking.find({
      operation: 'G',
      userId,
      challengeId: challenge._id
    });

    const balance = participatedTimes?.length * dailyAmount;

    const challengeFinishedToday = await Tracking.findOne({
      userId,
      challengeId: challenge._id,
      operation:{
        $in: ['G','L'],
      },
      register:{
        $lte: moment().endOf('day'),
        $gte: moment().startOf('day'),
      }
    })



    const periodDiscipline = Boolean(challengeFinishedToday)? currentPeriod: currentPeriod - 1;
    const discipline = participatedTimes?.length / periodDiscipline || 0;

    const dailyResults = await Tracking.find({
      challengeId: challenge._id,
      operation:{
        $in: ['G','L'],
      },
      register:{
        $lte: moment().endOf('day'),
        $gte: moment().startOf('day'),
      }
    }).populate('userId', 'name photo').select('userId amount operation');




    res.json({
      isParticipant: Boolean(userChallenge),
      challenge,
      challengePeriod,
      currentPeriod,
      dailyAmount,
      participatedTimes: participatedTimes?.length,
      balance,
      challengeFinishedToday: Boolean(challengeFinishedToday),
      discipline,
      dailyResults
    })

  }catch(err){
    res.json({error:true, message: err.message});
  }
});

router.get('/:userId/balance', async(req, res) => {
  try{

    const { userId } = req.params;

    const records = await Tracking.find({
      userId,
    }).sort([['register', -1]]);

    const balance = records.filter(t => t.operation === 'G').reduce((total, t) => total + t.amount, 0);

    res.json({records,balance});

  }catch(err){
    res.json({error:true, message: err.message});
  }
});

export default router;
