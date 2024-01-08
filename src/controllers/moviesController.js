const path = require("path");
const db = require("../database/models");
const sequelize = db.sequelize;
const { Op } = require("sequelize");
const moment = require("moment");
const fetch = require("node-fetch");
const axios = require("axios");
const { response } = require("express");
const paginate = require('express-paginate');
const translatte = require('translatte')

//Aqui tienen otra forma de llamar a cada uno de los modelos
const Movies = db.Movie;
const Genres = db.Genre;
const Actors = db.Actor;
const URL_BASE = "http://www.omdbapi.com/?&apikey=fb1883b8";

const moviesController = {
  list: (req, res) => {
    db.Movie.findAndCountAll({
      include : ["genre"],
      limit : req.query.limit,
      offset : req.skip
    }).then(({count, rows}) => {

        const pagesCount = Math.ceil(count / req.query.limit);

        return res.render("moviesList.ejs", {
            movies: rows,
            pages : paginate.getArrayPages(req)(pagesCount, pagesCount, req.query.page),
            paginate,
            pagesCount,
            currentPage : req.query.page,
            result : 0
         });
    });
  },
  detail: (req, res) => {
    db.Movie.findByPk(req.params.id, {
      include: ["genre", "actors"],
    }).then((movie) => {
      //return res.send(movie)
      res.render("moviesDetail.ejs", { ...movie.dataValues, moment });
    });
  },
  new: (req, res) => {
    db.Movie.findAll({
      order: [["release_date", "DESC"]],
      limit: 5,
    }).then((movies) => {
      res.render("newestMovies", { movies });
    });
  },
  recomended: (req, res) => {
    db.Movie.findAll({
      include: ["genre"],
      where: {
        rating: { [db.Sequelize.Op.gte]: 8 },
      },
      order: [["rating", "DESC"]],
    }).then((movies) => {
      res.render("recommendedMovies.ejs", { movies });
    });
  },
  //Aqui debo modificar para crear la funcionalidad requerida
  buscar: (req, res) => {
    const title = req.query.titulo;

    fetch(`${API}&t=${title}`)
      .then((data) => {
        return data.json();
      })
      .then((movie) => {
        //console.log(movie)
        return res.render("moviesDetailOmdb", {
          movie,
        });
      })
      .catch((error) => console.log(error));
  },
  //Aqui dispongo las rutas para trabajar con el CRUD
  add: function (req, res) {
    let promGenres = Genres.findAll();
    let promActors = Actors.findAll();

    Promise.all([promGenres, promActors])
      .then(([allGenres, allActors]) => {
        return res.render(path.resolve(__dirname, "..", "views", "moviesAdd"), {
          allGenres,
          allActors,
        });
      })
      .catch((error) => res.send(error));
  },
  create: function (req, res) {
    Movies.create({
      title: req.body.title,
      rating: req.body.rating,
      awards: req.body.awards,
      release_date: req.body.release_date,
      length: req.body.length,
      genre_id: req.body.genre_id,
    })
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
  edit: function (req, res) {
    let movieId = req.params.id;
    let promMovies = Movies.findByPk(movieId, { include: ["genre", "actors"] });
    let promGenres = Genres.findAll();
    let promActors = Actors.findAll();
    Promise.all([promMovies, promGenres, promActors])
      .then(([Movie, allGenres, allActors]) => {
        Movie.release_date = moment(Movie.release_date).format("L");
        return res.render(
          path.resolve(__dirname, "..", "views", "moviesEdit"),
          { Movie, allGenres, allActors }
        );
      })
      .catch((error) => res.send(error));
  },
  update: function (req, res) {
    let movieId = req.params.id;
    Movies.update(
      {
        title: req.body.title,
        rating: req.body.rating,
        awards: req.body.awards,
        release_date: req.body.release_date,
        length: req.body.length,
        genre_id: req.body.genre_id,
        image: req.file ? req.file.filename : null,
      },
      {
        where: { id: movieId },
      }
    )
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
  delete: function (req, res) {
    let movieId = req.params.id;
    Movies.findByPk(movieId)
      .then((Movie) => {
        return res.render(
          path.resolve(__dirname, "..", "views", "moviesDelete"),
          { Movie }
        );
      })
      .catch((error) => res.send(error));
  },
  destroy: function (req, res) {
    let movieId = req.params.id;
    Movies.destroy({ where: { id: movieId }, force: true }) // force: true es para asegurar que se ejecute la acción
      .then(() => {
        return res.redirect("/movies");
      })
      .catch((error) => res.send(error));
  },
  search: (req, res) => {
    const keyword = req.query.keyword;

    db.Movie.findAll({
      where: {
        title: {
          [Op.substring]: keyword
        }
      }
    }).then((movies) => {
        //if (!movies.length) {
          if (!axios.get(`${URL_BASE}&t=${keyword}`).length){
            return res.render("moviesList", { movies, result: 1, pages : 1, keyword });
          } else {
          axios.get(`${URL_BASE}&t=${keyword}`)
          .then(async (response) => {
            const { Title, Released, Genre, Awards, Poster, Ratings } =
              response.data;

            const awardsArray = Awards.match(/\d+/g);
            const awardsParseado = awardsArray.map((award) => +award);
            const awards = awardsParseado.reduce((acum, num) => acum + +num, 0);
            const rating = Ratings[0].Value.split("/")[0];
            const release_date = moment(Released).toDate();
            const image = Poster;
            const newGenre = Genre.split(",")[0];
            let genre_id;

            if (newGenre) {
               const { text } = await translatte(newGenre, { to: "es" }); // traduce género

              const genres = await db.Genre.findAll({
                order: [["ranking", "DESC"]],
              });

              const [genre, genreCreated] = await db.Genre.findOrCreate({
                where: { name: text },
                defaults: {
                  active: 1,
                  ranking: genres[0].ranking + 1,
                },
              });
              genre_id = genre.id;
            }

            let newMovie = {
              title : Title,
              awards,
              rating,
              release_date,
              image,
              genre_id,
            };
            db.Movie.create(newMovie)
            .then(() => {
              db.Movie.findAll({
                where: {
                  title: {
                    [Op.substring]: keyword
                  }
                }
              })
              .then(movies => {
                return res.render("moviesList", { movies, result: 1, pages: 1 });
              });
            });
          });
        }
      //  }else{
      //    return res.render("moviesList", { movies, result: 1, pages: 1 });
      //  }
      
        
      })
      .catch((error) => console.log(error));
  },
};

module.exports = moviesController;
