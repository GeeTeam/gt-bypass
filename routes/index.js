var express = require('express');
var router = express.Router();
var svgCaptcha = require('svg-captcha');
var GEETEST_SESSION = "geeSession";
var modearr = ['geetest', 'char', 'empty']; // 预设的验证形式
var activeMode = 'geetest';// geetest/char/empty

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/changeMode', function(req, res, next) {
  if(req.query.user === "admin" && req.query.pass === "123"){
    if(req.query.mode && modearr.indexOf(req.query.mode)>-1){
      activeMode = req.query.mode;
      return res.send({
        status: "success",
        info: '切换成功',
        activeMode: activeMode
      })
    }
  }
  res.send({
      status: "fail",
      info: '操作失败'
    })
});



router.get('/getMode',function (req,res) {
  res.send({
    activeMode: activeMode,
    modearr: modearr,
    useHeartbeats: useHeartbeats
  })
})



var click = require('../config/click');

router.get('/getImg',function (req,res) {
  var captcha = svgCaptcha.create();
  req.session.captcha = captcha.text;
  res.type('svg');
  res.status(200).send(captcha.data);
});


router.get("/gt/register-click", function (req, res) {
  return handleRegister[activeMode](req,res);

});
router.post("/gt/validate-click", function (req, res) {
  return handleValidate[activeMode](req,res);
});

var handleRegister = {
  geetest(req,res){
    // 向极验申请每次验证所需的challenge
    click.register(function (err, data) {
      if (err) {
        console.error(err);
        return;
      }
      req.session[GEETEST_SESSION] = data.success;
      if (!data.success) {
        // 进入 failback，如果一直进入此模式，请检查服务器到极验服务器是否可访问
        // 可以通过修改 hosts 把极验服务器 api.geetest.com 指到不可访问的地址

        // 为以防万一，你可以选择以下两种方式之一：

        // 1. 继续使用极验提供的failback备用方案
        res.send({
          data: data,
          mode: 'geetest'
        });

        // 2. 使用自己提供的备用方案
        // todo

      } else {
        // 正常模式
        res.send({
          data:data,
          mode: 'geetest'
        });
      }
    });

  },
  char(req,res){
    return res.send({
      mode: 'char'
    })

  },
  empty(req,res){
    return res.send({
      mode: 'empty'
    })
  }
};

var handleValidate = {
  geetest(req,res){

    const status = req.session[GEETEST_SESSION];

    if (status == undefined) {
      return res.json({"status": "fail", "info": "session取key发生异常"});
    }

    if(status == 1){
      // 对ajax提供的验证凭证进行二次验证,正常验证
      click.validate({
        geetest_challenge: req.body.geetest_challenge,
        geetest_validate: req.body.geetest_validate,
        geetest_seccode: req.body.geetest_seccode

      }, function (err, success) {

        if (err) {

          // 网络错误
          res.send({
            status: "error",
            info: err
          });

        } else if (!success) {

          // 二次验证失败
          res.send({
            status: "fail",
            info: '登录失败'
          });
        } else {

          res.send({
            status: "success",
            info: '登录成功'
          });
        }
      });
    }else {
      /**
       * 异常流程下（即验证初始化失败，宕机模式），二次验证
       * 注意：由于是宕机模式，初衷是保证验证业务不会中断正常业务，所以此处只作简单的参数校验，可自行设计逻辑。
       */
      if(!click.checkParam(req.body.geetest_challenge,req.body.geetest_validate,req.body.geetest_seccode)){
        // 二次验证失败
        res.send({
          status: "fail",
          info: '宕机模式，本地校验，参数challenge、validate、seccode不可为空.'
        });
      }else {
        res.send({
          status: "success",
          info: '登录成功'
        });
      }

    }
  },
  char(req,res){
    // 启用字符验证
    if(req.session.captcha.toLowerCase() === req.body.text.toLowerCase()){
      return res.send({
        status: "success",
        info: '登录成功'
      });
    }
    // 二次验证失败
    return res.send({
      status: "fail",
      info: '登录失败'
    });
  },
  empty(req, res) {
    return res.send({
      status: "success",
      info: '登录成功'
    });
  }
}





module.exports = router;
