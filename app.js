import express from "express";
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv'
import bcrypt from 'bcrypt';
import joi from 'joi';
import {v4 as uuid} from "uuid";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
    db = mongoClient.db("library");
});

const app = express();
app.use(express.json());
app.use(cors());

const token = uuid();

app.post("/sign-up", async (req, res) => {
    const user = req.body;
    const passwordHash = bcrypt.hashSync(user.password, 10);

    const userSchema = joi.object({
        name: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required()
    })

    const validation = userSchema.validate(user);

    if(validation.error){
        return res.sendStatus(422);
    }

    try{
        await db.collection('users').insertOne({ ...user, password: passwordHash }) 
        res.sendStatus(201);  
    }catch (error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.post("/sign-in", async (req, res) => {
    const {email, password} = req.body;

    const loginSchema = joi.object({
        email: joi.string().email().required(),
        password: joi.string().required()
    })

    const validation = loginSchema.validate({email, password});

    if(validation.error){
        return res.sendStatus(422);
    }
    try{
        const user = await db.collection('users').findOne({ email });

        if(!user){
            res.sendStatus(401);
            return;
        }

        const isAuthorized = bcrypt.compareSync(password, user.password)
        if(isAuthorized){

            await db.collection("sessions").insertOne({
                userId: user._id,
                token
            })
            return res.send({token:token, name:user.name});
        }
        res.sendStatus(401);
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
    }

});

app.post("/entry", async (req, res) => {
    const transaction = req.body;
    const transactionSchema = joi.object({
        value: joi.string().required(),
        description: joi.string().required(),
        status: joi.string()
    })

    const validation = transactionSchema.validate(transaction);

    if(validation.error){
        return res.sendStatus(422);
    }

    try{

        await db.collection('transactions').insertOne({ transaction }) 
        res.sendStatus(201);  
    }catch (error){
        console.log(error);
        res.sendStatus(500);
    }
});

app.get("/entry", async (req,res) => {
    const { authorization } = req.headers;
    const token = authorization?.replace('Bearer ', '');
    const transactions = await db.collection('transactions').find().toArray();
    if(!token) return res.sendStatus(401);
  
    try{
        const session = await db.collection("sessions").findOne({ token });
              
    if (!session) {
        return res.sendStatus(401);
    }
    
    res.send(transactions);
    }catch (error){
        console.log(error);
        res.sendStatus(500)
    }
  });

app.listen(process.env.PORT, () => {
    console.log("Rodando em " + process.env.PORT)
});