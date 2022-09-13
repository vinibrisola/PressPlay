import express, { request } from 'express';
import mongoose from 'mongoose';
import moment from 'moment';
import pagarme from '../services/pagarme.js';
import util from '../util.js';
import User from '../models/user.js';
import Challenge from '../models/challenge.js';
import Tracking from '../models/tracking.js';
import UserChallenge from '../models/relationship/userChallenge.js';
import _ from 'lodash';

const router = express.Router();

router.post('/join', async (req, res) => {
  try{
    const { userId, challengeId, creditCard } = req.body;
    //ler dados do usuario e desafio
    const user = await User.findById(userId);
    const challenge = await Challenge.findById(challengeId);
    const challengePrice = util.toCents(challenge.fee);
    //criar transação do pagarme

      // CRIAR TRANSAÇÃO PAGARME
      const createPayment = await pagarme('/transactions', {
        amount: challengePrice,
        customer: {
          id: user.customerId,
        },
        ...creditCard,
        billing: {
          name: 'Trinity Moss',
          address: {
            country: 'br',
            state: 'sp',
            city: 'Cotia',
            neighborhood: 'Rio Cotia',
            street: 'Rua Matrix',
            street_number: '9999',
            zipcode: '06714360',
          },
        },
        items: [
          {
            id: challengeId,
            title: challenge.title,
            unit_price: challengePrice,
            quantity: 1,
            tangible: false,
          },
        ],
      });
    if(createPayment.error){
      throw createPayment;
    }

    await new Tracking({
      userId,
      challengeId,
      operation: 'F',
      transactionId: createPayment.data.id,
      amount: challenge.fee,
    }).save();

    await new UserChallenge({
      userId,
      challengeId,
    }).save();

    res.json({message: 'Desafio Aceito'})
  }catch(err){
    res.json({error:true, message: err.message});
  }
});

router.post('/tracking', async (req, res) => {
  try{
    const { userId, challengeId , operation } = req.body;
    const existentTrackingType = await Tracking.findOne({
       userId,
       challengeId,
       operation,
       register:{
        $lte: moment().endOf('day'),
        $gte: moment().startOf('day'),
      },
    });

    if(!existentTrackingType){
      await new Tracking(req.body).save();
    }

    res.json({message: 'Evento Registrado'});
  }catch(err){
    res.json({error:true, message: err.message});
  }
})

router.get('/:challengeId/ranking', async(req, res) => {
  try{
    const { challengeId } = req.params;

    const challenge = await Challenge.findById(challengeId);

    const dayStart = moment(challenge.date.start, 'YYYY-MM-DD');
    const dayEnd = moment(challenge.date.end, 'YYYY-MM-DD');
    const challengePeriod = dayEnd.diff(dayStart, 'days');
    const currentPeriod = moment().diff(dayStart.subtract(1,'day'), 'days');

    const trackings = await Tracking.find({
      challengeId,
      operation: ['G', 'L']
    }).populate('userId', 'name photo');

    const records = _.chain(trackings).groupBy('userId._id').toArray().map((trackingUser)=> ({
      _id: trackingUser[0].userId._id,
      name: trackingUser[0].userId.name,
      photo: trackingUser[0].userId.photo,
      performance: trackingUser.filter(t => t.operation === 'G').length
    })).orderBy('performance', 'desc');


    const extraBalance = trackings.filter((t) => t.operation === 'L').reduce((total, t)=> {
      return total + t.amount;
    }, 0);

    res.json({
      challengeDate: challenge.date,
      currentPeriod,
      challengePeriod,
      records,
      extraBalance
    })
  }catch(err){
    res.json({error:true, message: err.message});
  }
});

export default router;
