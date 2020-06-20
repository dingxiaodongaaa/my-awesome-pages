const { src, dest, parallel, series, watch, env } = require("gulp");

const del = require("del"); // 这不是一个gulp插件，但是gulp可以用

const browserSync = require("browser-sync");
const bs = browserSync.create(); // 利用这个模块导出的create方法创建一个服务器

const loadPlugins = require("gulp-load-plugins"); // 这个插件导出的是一个方法，这个方法返回的是一个对象，所有的gulp依赖的插件都会成为这个对象下面的一个属性
const plugins = loadPlugins();

const data = require("./src/assets/data/initdata");

const clean = () => {
  return del(["dist", "temp"]); // del方法返回的就是一个promise，所以可以在gulp异步任务中直接将其return
};

// fetch command line arguments
const arg = ((argList) => {
  let arg = {},
    a,
    opt,
    thisOpt,
    curOpt;
  for (a = 0; a < argList.length; a++) {
    thisOpt = argList[a].trim();
    opt = thisOpt.replace(/^\-+/, "");

    if (opt === thisOpt) {
      // argument value
      if (curOpt) arg[curOpt] = opt;
      curOpt = null;
    } else {
      // argument name
      curOpt = opt;
      arg[curOpt] = true;
    }
  }

  return arg;
})(process.argv);

// 基本上每一个插件提供的都是一个函数，这个函数的调用结果会返回一个文件的转换流。

const style = () => {
  return src("src/assets/styles/*.scss", { base: "src" }) // 配置base参数，是为了维持构建的文件的目录结构
    .pipe(plugins.sass({ outputStyle: "expanded" })) // sass编译模块会将下划线开头的文件识别为主文件中依赖的文件，默认在转换的过程中会将这些文件忽略。outputStyle配置样式完全展开。
    .pipe(
      plugins.stylelint({
        reporters: [
          {formatter: 'string', console: true}
        ]
      })
    )
    .pipe(plugins.csscomb())
    .pipe(dest("temp"))
    .pipe(bs.reload({ stream: true })); // 替代server中的files属性
};

const script = () => {
  return src("src/assets/scripts/*.js", { base: "src" })
    .pipe(plugins.eslint({ configFle: "./.eslintrc" }))
    .pipe(plugins.eslint.format())
    .pipe(plugins.eslint.failAfterError())
    .pipe(plugins.babel({ presets: ["@babel/preset-env"] })) // 这里需要配置gulp-babel所依赖的转换模块，preset-env默认的会将所有的ECMAScript中所有的新特性进行转换。
    .pipe(dest("temp"))
    .pipe(bs.reload({ stream: true }));
};

const page = () => {
  return src("src/*.html", { base: "src" }) // src下面的任意子目录下的html文件。 其实这里设置base是没有意义的，因为管道的入口就是src。此处写上是为了统一。
    .pipe(
      plugins.swig({
        data,
        defaults: { cache: false }, // 配置html模板不缓存，如果缓存会影响html的热更新
      })
    )
    .pipe(dest("temp"))
    .pipe(bs.reload({ stream: true }));
};

const image = () => {
  return src("src/assets/images/**", { base: "src" })
    .pipe(plugins.imagemin()) // 这个插件下载的很慢或者可能下载失败，改一下hosts文件就好了。
    .pipe(dest("dist"));
};

const font = () => {
  return src("src/assets/fonts/**", { base: "src" })
    .pipe(plugins.imagemin())
    .pipe(dest("dist"));
};

const extra = () => {
  return src("public/**", { base: "public" }).pipe(dest("dist"));
};

const devserver = () => {
  watch("src/assets/styles/*.scss", style);
  watch("src/assets/scripts/*.js", script);
  watch("src/**/*.html", page);
  // 下面这些资源文件在开发阶段是没有必要构建的，构建只会无端增加开发时构建的开销，降低构建效率。
  // 上线的时候压缩这些文件也只是为了减小文件的体积，提高网站的速度。
  // watch('src/assets/images/**', image)
  // watch('src/assets/fonts/**', font)
  // watch('public/**', extra)

  // 当文件变化的时候，为了实现热更新，可以再添加一个监听任务
  watch(
    [
      "src/assets/data/*.js",
      "src/assets/images/**",
      "src/assets/fonts/**",
      "public/**",
    ],
    bs.reload
  );

  // 配置参数
  let options = {
    port: arg.port || 2080,
    open: arg.open || false,
  };

  // 初始化服务配置
  bs.init({
    notify: false, // 启动服务或刷新的时候不会弹出提示窗口
    port: options.port, // 配置服务端口号
    open: options.open, // 启动服务之后不会自动在浏览器中打开
    // files: 'dist/**', // 监听dist下面的所有的文件，一旦文件改变自动刷新网页
    server: {
      baseDir: ["temp", "src", "public"], // baseDir 支持传入一个数组，当服务启动之后，请求的文件会从数组的第一个文件夹开始知道找到要请求的文件。
      routes: {
        // 当一个请求发生之后，会先去查找在routes中是否有相应的配置，如果有就直接走routes中的配置，如果没有则去baseDir中找
        "/node_modules": "node_modules",
      },
    },
  });
};

const scriptLint = () => {
  return src("src/assets/scripts/*.js")
    .pipe(plugins.eslint({ configFle: "./.eslintrc" }))
    .pipe(plugins.eslint.format())
    .pipe(plugins.eslint.failAfterError());
};

const styleLint = () => {
  return src("src/assets/styles/*.scss", { base: "src" }) // 配置base参数，是为了维持构建的文件的目录结构
    .pipe(plugins.sass({ outputStyle: "expanded" })) // sass编译模块会将下划线开头的文件识别为主文件中依赖的文件，默认在转换的过程中会将这些文件忽略。outputStyle配置样式完全展开。
    .pipe(
      plugins.stylelint({
        reporters: [
          {formatter: 'string', console: true}
        ]
      })
    )
};

// 打包之后的html文件中的js或者是css的引入路径可能会出现错误，或者该引入的文件在node_modules中，项目打包之后根本就没有这个文件，所以这里需要一个useref来将html中的引入的文件引入进来。
const useref = () => {
  // 注意在gulp的任务中最好不要对同一个目录进行同时的读操作和写操作，否则会出现读写冲突，发生意想不到的问题
  return src("temp/**/*.html", { base: "temp" })
    .pipe(plugins.useref({ searchPath: ["temp", "."] })) // 会将html中引入的文件打包成一个文件保存到指定目录并再html中引入
    .pipe(plugins.if(/\.js$/, plugins.uglify())) // 当文件创建完成之后，可以对创建完的文件进行优化，比如压缩等。这里可能会有三种类型的文件，html\css\js
    .pipe(plugins.if(/\.css$/, plugins.cleanCss())) // if会自动创建一个转换流，这个转换流内部会根据指定的条件去执行对应的转换流
    .pipe(
      plugins.if(
        /\.html$/,
        plugins.htmlmin({
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
        })
      )
    ) // 默认只是会将html中的空格删除，并不会将换行符删除，要删除可以配置一个字段collapseWhitespace,htmlmin还有一些其他的配置参数，比如说删除注释、删除空白属性等，具体查看文档。
    .pipe(dest("dist")); // 使用一个新的目录来存放最终构建完成的目录，直接写入dist会出现读写冲突
  // 使用一个新的目录之后，会出现一个严重的问题，构建完成之后的项目的目录结构被打乱了！所以需要重新规整一些构建目录。
  // 思路就是，创建一个temp目录，用于开发时测试用，这个临时的目录也只用于开发时的测试，最终打包之后的目录再使用dist目录。
};

const proserver = () => {
  // 配置参数
  let options = {
    port: arg.port || 2080,
    open: arg.open || false,
  };

  // 初始化服务配置
  bs.init({
    notify: false, // 启动服务或刷新的时候不会弹出提示窗口
    port: options.port, // 配置服务端口号
    open: options.open, // 启动服务之后不会自动在浏览器中打开
    files: "dist/**", // 监听dist下面的所有的文件，一旦文件改变自动刷新网页
    server: {
      baseDir: "dist", // baseDir 支持传入一个数组，当服务启动之后，请求的文件会从数组的第一个文件夹开始知道找到要请求的文件。
    },
  });
};

const compile = parallel(style, script, page); // 并行执行任务

const lint = parallel(scriptLint, styleLint);

// 上线之前执行的任务
const build = series(
  clean,
  parallel(series(compile, useref), extra, image, font)
);

const serve = series(compile, devserver);

const start = series(build, proserver);

module.exports = {
  clean,
  serve,
  lint,
  build,
  start,
  compile
};
