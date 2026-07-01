const express = require('express');
const router = express.Router({ mergeParams: true });
// const fieldsRouter = require('./fields');
const {pool} = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')

router.get(['/new'], async (req, res, next) => {
    try{
        let data = {
            page: `/newFacility`,
            user: req.user
            
        }
        res.render('newFacilityForm.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/add', async (req, res, next) => {
    // Process form data here
    try{
        const request = pool.request()
        await request
        .input('facilityName', sql.VarChar, req.body.facilityName)
        .input('facilityAddress', sql.VarChar, req.body.facilityAddress)
        .input('facilityAbbreviation', sql.VarChar, req.body.facilityAbbreviation)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM facilities WHERE facilityName = @facilityName)
            BEGIN
                insert into facilities (facilityName, facilityAddress, facilityAbbreviation)
                values (@facilityName,@facilityAddress, @facilityAbbreviation)
            END
            `)
        res.redirect(302,'/facilities')
    }catch(err){
        next(err)
    }
  });
  router.post('/:facilityId/editFacility', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,

          }     
          await pool.request()
          .input('facilityId', sql.VarChar, req.params.facilityId)
          .input('facilityName', sql.VarChar, req.body.facilityName)
          .input('facilityAddress', sql.VarChar, req.body.facilityAddress)
          .input('facilityAbbreviation', sql.VarChar, req.body.facilityAbbreviation)
          .query(`
              UPDATE facilities
              set facilityName = @facilityName,
              facilityAddress = @facilityAddress,
              facilityAbbreviation = @facilityAbbreviation
              where facilityId = @facilityId
              `)
          res.redirect(302,`/facilities/${req.params.facilityId}`)
      }catch(err){
          next(err)
      }
  });
  router.get('/:facilityId/editFacility', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,
              page: '/editFacility'
          }
  
          let result = await pool.request()
          .input('facilityId', sql.VarChar, req.params.facilityId)
          .query(`
              SELECT * 
              from dbo.facilities
              where facilityId = @facilityId
              `)        
          data.data = result.recordset[0]
          
          res.render('editFacility.ejs',{data: data})
      }catch(err){
          next(err)
      }
  });
  router.use('/:facilityId/fields', require('./fields'));

  router.get('/:facilityId', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,
              page: 'teams/details'
          }
          const result = await pool.request()
          .input('facilityId', sql.VarChar, req.params.facilityId)
          .query(`
              SELECT * 
              from dbo.facilities
              where facilityId = @facilityId
              `)        
          data.data = result.recordset[0]
          
          res.render('facilityDetails.ejs',{data: data})
      }catch(err){
          next(err)
      }
  });
router.get('/', async (req,res, next)=>{
    try{
        let data = {
            
            page: 'facilities',
            user: req.user
        }
        const request = pool.request()
        const result = await request.query(`
            select * from facilities
            order by facilityName
        `)
        data.list = result.recordset
        res.render('facilities.ejs',{data: data}) 
    }catch(err){
        next(err)
    }
});

module.exports = router;
