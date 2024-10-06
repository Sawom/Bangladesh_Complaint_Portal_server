const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const app = express();

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

        // get all users and email wise user info ++ pagination
        app.get('/users', async(req, res)=>{
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

        // load single user. need to load single user before put operation
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
            const query = {_id : new ObjectId(id)};
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })
        //********  user part done *********

        //******** review part ******** 
        // post reviews
        app.post('/reviews', async(req,res)=>{
            const newReview = req.body;
            const result = await reviewCollection.insertOne(newReview);
            res.send(result);
        })

        // get reviews both all and email wise
        app.get('/reviews', async(req, res)=>{
            const email = req.query.email;
            const page = parseInt(req.query.page) || 1;  // current page start from 1
            const limit = parseInt(req.query.limit) || 10; // limit data per page
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
                        totalReview,
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
        app.get('/complains', async(req, res)=>{
            const email = req.query.email;
            const page = parseInt(req.query.page) || 1;  // current page start from 1
            const limit = parseInt(req.query.limit) || 10; // limit data per page
            const skip = (page - 1) * limit; // Calculate the number of documents to skip

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
                    const result = await complainCollection.find().skip(skip).limit(limit).toArray();
                    const totalComplains = await complainCollection.countDocuments(); // Count for all documents

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