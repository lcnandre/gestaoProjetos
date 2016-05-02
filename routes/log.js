require('../models/log');
require('../models/acao');

var express = require('express');
var mongoose = require('mongoose');
var request = require('request');
var async = require('async');
var Log = mongoose.model('Log');
var Acao = mongoose.model('Acao');
var router = express.Router();

router.get('/', function(req, res, next) {
  Log.find(function(err, logs) {
    if(err) return next(err);
    res.json(logs);
  });
});

router.get('/:id', function(req, res, next) {
  var query = Log.findById(req.params.id).populate('acao');

  query.exec(function(err, log) {
    if (err) return next(err);
    if (!log) return next(new Error('log não encontrado'));
    res.json(log);
  });
});

router.get('/usuario/:usuario/:log?', function(req, res, next) {
  var params = {'usuario': req.params.usuario};
  if (req.params.log) params['_id'] = req.params.log;
  var query = Log.find(params).populate('acao');

  query.exec(function(err, logs) {
    if (err) return next(err);
    if (!logs) return next(new Error('log não encontrado'));

    async.map(logs, function(log, callBack) {
      if (log.acao !== null) {
        populaEstatisticas(log.usuario).then(function(estatisticas) {
          var ret = log.toObject();
          ret.estatisticas = estatisticas.filter(function(est) {
            return est['_id'] == log.referencia;
          })[0];
          ret.estatisticas = normalizaEstatisticas(ret.estatisticas);

          Object.keys(ret.estatisticas).forEach(function(chave) {
            ret[chave] = ret.estatisticas[chave];
          });
          delete ret.estatisticas;

          if (ret.acao && ret.acao !== null) ret.acao = ret.acao.nome;
          delete ret.referencia;
          delete ret['__v'];
          delete ret['_id'];
          callBack(null, ret);
        });
      } else {
        callBack(null, null);
      }
    }, function(err, logs) {
      res.json(logs.filter(function (l) { return l !== null }));
    });
  });
});

router.get('/usuario/:usuario/referencia/:ref', function(req, res, next) {
  var query = Log.find({
    'usuario': req.params.usuario,
    'referencia': req.params.ref
  }).populate('acao');

  query.exec(function(err, log) {
    if (err) return next(err);
    if (!log) return next(new Error('log não encontrado'));
    res.json(log);
  });
});

router.post('/', function(req, res, next) {
  var log = new Log(req.body);

  log.save(function(err, log){
    if(err) return next(err);
    res.json(log);
  });
});

router.put('/', function(req, res, next) {
  var query = {'_id': req.body._id};

  Log.findOneAndUpdate(query, req.body, {new: true}, function(err, log) {
    if (err) return next(err);
    if (!log) return next(new Error('log não encontrado'));
    res.json(log);
  });
});

router.delete('/:id', function(req, res, next) {
  var query = Log.findById(req.params.id);

  query.exec(function(err, log) {
    if (err) return next(err);
    if (!log) return next(new Error('log não encontrado'));
    log.remove();
    res.json(log);
  });
});

var populaEstatisticas = function(usuario) {
  var promise = new Promise(function(resolve, reject) {
    request('http://localhost:8080/api/estatisticas/' + usuario.toString(), function(error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve(JSON.parse(body));
      } else {
        console.trace(error);
        resolve([]);
      }
    });
  });

  return promise;
};

var normalizaEstatisticas = function(est) {
  est.projeto = est._id;

  Object.keys(est.equipe).forEach(function(membro) {
    est['membro'+membro] = est.equipe[membro];
  });

  est.itens.forEach(function(item) {
    est['itemDeadline'+item._id] = item.deadline;
    est['itemResponsavel'+item._id] = item.responsavel;
    est['itemStatus'+item._id] = item.status;
    est['itemPrioridade'+item._id] = item.prioridade;
    est['itemPercConcluido'+item._id] = item.percConcluido;
    est['itemDiasRestantes'+item._id] = item.diasRestantes;
    est['itemHorasUsadas'+item._id] = item.horasUsadas;
    est['itemHorasEstimadas'+item._id] = item.horasEstimadas;
    est['itemRazaoEstimativa'+item._id] = item.razaoEstimativa;
    est['itemSituacao'+item._id] = item.situacao;
  });

  delete est.nome;
  delete est._id;
  delete est.equipe;
  delete est.itens;

  return est;
};

module.exports = router;
