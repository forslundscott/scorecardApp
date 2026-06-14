const express = require('express');
const router = express.Router({ mergeParams: true });
const {pool} = require(`../db`)
const sql = require('mssql');
const functions = require('../helpers/functions')
const { checkAuthenticated, checkNotAuthenticated, authRole } = require('../middleware/authMiddleware')


router.get(['/new'], async (req, res, next) => {
    try{
        let data = {
            page: `/newField`,
            user: req.user,
            facilityId: req.params.facilityId
        }
        res.render('newFieldForm.ejs',{data: data})
    }catch(err){
        console.error('Error:', err)
    }
})
router.post('/add', async (req, res, next) => {
    // Process form data here
    try{
        const request = pool.request()
        await request
        .input('fieldName', sql.VarChar, req.body.fieldName)
        .input('facilityId', sql.Int, req.params.facilityId)
        .input('fieldType', sql.VarChar, req.body.fieldType)
        .query(`

                insert into fields (fieldName, facilityId, fieldType)
                values (@fieldName,@facilityId, @fieldType)

            `)
        res.redirect(`/facilities/${req.params.facilityId}/fields`);
    }catch(err){
        next(err)
    }
  });
  router.post('/:fieldId/edit', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,

          }     
          await pool.request()
          .input('facilityId', sql.Int, req.params.facilityId)
          .input('fieldId', sql.Int, req.body.fieldId)
          .input('fieldName', sql.VarChar, req.body.fieldName)
          .input('fieldType', sql.VarChar, req.body.fieldType)
          .query(`
              UPDATE fields
              set fieldName = @fieldName,
              fieldType = @fieldType
              where facilityId = @facilityId
              and fieldId = @fieldId
              `)
          res.redirect(302,`/facilities/${req.params.facilityId}/fields/${req.params.fieldId}`)
      }catch(err){
          next(err)
      }
  });
  router.get('/:fieldId/edit', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,
              page: '/editField'
          }
  
          let result = await pool.request()
          .input('facilityId', sql.Int, req.params.facilityId)
          .input('fieldId', sql.Int, req.params.fieldId)
          .query(`
              SELECT * 
              from dbo.fields
              where facilityId = @facilityId
              and fieldId = @fieldId
              `)        
          data.data = result.recordset[0]
          
          res.render('editField.ejs',{data: data})
      }catch(err){
          next(err)
      }
  });
router.get('/', async (req,res, next)=>{
      try{
          let data = {
              user: req.user,
              page: 'teams/details',
              list: []
          }
          const result = await pool.request()
          .input('facilityId', sql.VarChar, req.params.facilityId)
          .query(`
              SELECT * 
              from dbo.fields
              where facilityId = @facilityId
              `)        
          data.list = result.recordset
          console.log(data.list)
          res.render('fields.ejs',{data: data})
      }catch(err){
          next(err)
      }
  });
  
  module.exports = router;