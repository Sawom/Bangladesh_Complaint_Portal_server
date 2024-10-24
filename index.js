const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');

// middleware
app.use(cors());
app.use(express.json());

//connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bsdjaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0` ;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run(){
    try{
        await client.connect();

        // all collection
        const hotlineCollection = client.db('complainportal').collection('hotlines');
        const usersCollection = client.db('complainportal').collection('users');
        const reviewCollection = client.db('complainportal').collection('reviews');
        const homeReviewCollection = client.db('complainportal').collection('homereview');
        const complainCollection = client.db('complainportal').collection('complains');

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin or user after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin  && req.query.email !== email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // *** check user admin or not with jwt token****
        app.get('/users/admin/:email',verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })


        // all functions
        // get hotlines number
        app.get('/hotlines', async(req, res)=>{
            const result = await hotlineCollection.find().toArray();
            res.send(result);
        } )

        // get home review
        app.get('/homereview', async(req, res)=>{
            const result = await homeReviewCollection.find().toArray();
            res.send(result);
        } )

        //********  user part ********
        //********  search user by nid or email, backend search*************
        app.get('/search/:query', async (req, res) => {
            try {
                let query = req.params.query;
                let result = await usersCollection.find({
                    "$or": [
                        { nid: query },    // Search by exact nid match
                        { email: query }   // Search by exact email match
                    ]
                }).toArray();

                // console.log(result);
                res.send(result);
            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).send("An error occurred while searching.");
            }
        });

        // working ***********
        // get all users and email wise user info ++ pagination
        app.get('/users', verifyToken, verifyAdmin, async(req, res)=>{
            console.log(req.headers);
            const email = req.query.email;
            const page = parseInt(req.query.page) || 1;  // current page start from 1
            const limit = parseInt(req.query.limit) || 10;  // limit user per page
            const skip = (page-1) * limit; // Calculate the number of documents to skip
           
            try{
                let result;
                if(email){
                    const query = {email: email}
                    result = await usersCollection.find(query).toArray();
                    res.send(result);
                }
                else{
                    const result = await usersCollection.find().skip(skip).limit(limit).toArray();
                    const totalResults = await usersCollection.countDocuments(); // Count for all documents

                    // Use return here to stop execution
                    return res.json({ 
                        users: result,
                        totalResults,
                        currentPage: page,
                        totalPages: Math.ceil(totalResults / limit)
                    });
                }

            }
            catch (error) {
                console.error("Error fetching users:", error);
                res.status(500).send("An error occurred while fetching users.");
            }

        } )

        // load single user by id. need to load single user before put operation
        app.get('/users/:id', async(req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        // post info of users
        app.post('/users', async(req, res)=>{
            const user = req.body;
            const query = {email: user.email};
            const existingUser = await usersCollection.findOne(query);
            if(existingUser){
                return res.send({ message: 'user already exists!' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // update user profile
        app.put('/users/:id',  async(req,res)=>{
            const id = req.params.id;
            const updateUser = req.body;
            const filter = {_id: new ObjectId(id)};
            const options = {upsert: true};
            const updateUserInfo = {
                $set:{
                    name: updateUser.name,
                    address: updateUser.address,
                    img: updateUser.img,
                    nid: updateUser.nid,
                    email: updateUser.email
                }
            }
            const result = await usersCollection.updateOne(filter, updateUserInfo, options);
            res.send(result);
        } )

        // delete user
        app.delete('/users/:id', async(req, res)=>{
            const id = req.params.id;

            try{
                // fetch the user to be deleted by id
                const userToDelete = await usersCollection.findOne({ _id: new ObjectId(id)  });

                // check if the user's email is asawom250@gmail.com
                if(userToDelete?.email === 'asawom250@gmail.com'){
                    return res.status(403).send({ message: "You cannot delete the super Admin." });
                }
                
                // process delete user for other user
                const query = {_id : new ObjectId(id)};
                const result = await usersCollection.deleteOne(query);
                res.send(result);
            }catch (error) {
                console.error("Error deleting user:", error);
                res.status(500).send({ message: "An error occurred while deleting the user." });
            }
        })
        //********  user part done *********


        //******** review part ******** 
        // post reviews
        app.post('/reviews', async(req,res)=>{
            const newReview = req.body;
            const result = await reviewCollection.insertOne(newReview);
            res.send(result);
        })

        // get reviews both all and email wise ++ pagination backend
        app.get('/reviews', async(req, res)=>{
            const email = req.query.email;
            const page = parseInt(req.query.page) || 1;  // current page start from 1
            const limit = parseInt(req.query.limit) || 20; // limit data per page
            const skip = (page - 1) * limit; // Calculate the number of documents to skip

            try{
                let result;
                if(email){
                    const query = {email:email};
                    result = await reviewCollection.find(query).toArray();
                    res.send(result);
                }
                // here all review data is showed
                else{
                    const result = await reviewCollection.find().skip(skip).limit(limit).toArray(); // keep limits data,others skip
                    const totalReview = await reviewCollection.countDocuments(); // Count for all documents
                    // Use return here to stop execution
                    return res.json({
                        reviews: result,
                        totalReview, // if I want to show ui total number of review, exact this name will set in state
                        currentPage: page,
                        totalPages: Math.ceil(totalReview / limit)
                    })
                }

            }catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).send("An error occurred while fetching complains.");
            }
            
        } )

        // load single review for updating
        app.get('/reviews/:id', async(req,res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reviewCollection.findOne(query);
            res.send(result);
        }  )

        // update review
        app.put('/reviews/:id', async(req,res)=>{
            const id = req.params.id;
            const updateReview = req.body;
            const filter = {_id: new ObjectId(id) };
            const options = {upsert: true};
            const updateReviewInfo = {
                $set:{
                    comments: updateReview.comments,
                    rating: updateReview.rating 
                }
            }
            const result = await reviewCollection.updateOne(filter,updateReviewInfo,options);
            res.send(result);
        })

        // delete review
        app.delete('/reviews/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await reviewCollection.deleteOne(query);
            res.send(result);
        } )
        //******** review part done ******** 


        // ******** complains part ********
        // post complain
        app.post('/complains', async(req, res)=>{
            const newComplain = req.body;
            const result = await complainCollection.insertOne(newComplain);
            res.send(result);
        })

        // get all complains and email wise user info ++ pagination 
        // ++ filter by division, district, subdistrict, problem 
        app.get('/complains', async(req, res)=>{
            const email = req.query.email;
            const page = parseInt(req.query.page) || 1;  // current page start from 1
            const limit = parseInt(req.query.limit) || 20; // limit data per page
            const skip = (page - 1) * limit; // Calculate the number of documents to skip

            const filters = {} // object to store filter condition

            // adding filter parameters
            if(req.query.division){
                filters.division = req.query.division;
            }

            if(req.query.district){
                filters.district = req.query.district;
            }

            if(req.query.subDistrict){
                filters.subDistrict = req.query.subDistrict;
            }

            if (req.query.problem) {
                filters.problem = req.query.problem; 
            }

            try{
                let result;
                // if user is logged in then his posted complain are showed
                if(email){
                    const query = {email: email};
                    result = await complainCollection.find(query).toArray();
                    res.send(result);
                }
                // all complain data are showed for admin
                else{
                    const result = await complainCollection.find(filters).skip(skip).limit(limit).toArray();
                    const totalComplains = await complainCollection.countDocuments(filters); // Count for all documents

                    // Use return here to stop execution
                    return res.json({
                        complains: result,
                        totalComplains,
                        currentPage: page,
                        totalPages: Math.ceil(totalComplains / limit)
                    })

                }

            }
            catch (error) {
                console.error("Error fetching complains:", error);
                res.status(500).send("An error occurred while fetching complains.");
            }
        }  )

        // received complain
        app.patch('/complains/received/:id', async(req,res)=>{
            const id =req.params.id;
            const filter = {_id: new ObjectId(id) };
            const updateDoc = {
                $set:{
                    status: 'received'
                },
            }
            const result = await complainCollection.updateOne(filter, updateDoc)
            res.send(result);
        } )

        // search complain by id and email. backend search part
        app.get('/search/:query', async (req, res) => {
            try {
                let query = req.params.query;
                let result = await complainCollection.find({
                    "$or": [
                        { nid: query },    // Search by exact nid match
                        { email: query }   // Search by exact email match
                    ]
                }).toArray();

                res.send(result);
            } catch (error) {
                console.error("Error fetching data:", error);
                res.status(500).send("An error occurred while searching.");
            }
        });

        // delete complain
        app.delete('/complains/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id : new ObjectId(id)};
            const result = await complainCollection.deleteOne(query);
            res.send(result);
        })


        // ********* admin
        // ********* make admin
        app.patch('/users/admin/:id', async(req,res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)} ;
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        

        // admin stats
        app.get('/admin-stats' , async(req, res)=>{
            const hotline = await hotlineCollection.estimatedDocumentCount();
            const users = await usersCollection.estimatedDocumentCount();
            const reviews = await reviewCollection.estimatedDocumentCount();
            const homereview = await homeReviewCollection.estimatedDocumentCount();
            const complains = await complainCollection.estimatedDocumentCount();

            res.send({
                    hotline,
                    users,
                    reviews,
                    homereview,
                    complains
                }
            )
        })


    }
    finally{

    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('complain portal running');
})

app.listen(port, ()=> {
    console.log(`complain portal server running at ${port}` );
})