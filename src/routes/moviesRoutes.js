const express = require('express');
const router = express.Router();
const moviesController = require('../controllers/moviesController');
const upload = require('../middlewares/upload');

router.get('/movies', moviesController.list);
router.get('/movies/new', moviesController.new);
router.get('/movies/recommended', moviesController.recomended);
router.get('/movies/detail/:id', moviesController.detail);
//Rutas exigidas para la creación del CRUD
router.get('/movies/add', moviesController.add);
router.post('/movies/create', moviesController.create);
router.get('/movies/edit/:id', moviesController.edit);
router.put('/movies/update/:id',upload.single('image'), moviesController.update);
router.get('/movies/delete/:id', moviesController.delete);
router.delete('/movies/delete/:id', moviesController.destroy);
router.get('/movies/search',moviesController.search);

router.get('/movies/buscar', moviesController.buscar);
module.exports = router;