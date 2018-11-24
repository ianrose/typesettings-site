const devBuild = (process.env.NODE_ENV || '').trim().toLowerCase() === 'development'
const gulp = require('gulp')
const sass = require('gulp-sass')
const uglify = require('gulp-uglify')
const rename = require('gulp-rename')
const handlebars = require('gulp-hb')
const browserSync = require('browser-sync')
const watch = require('gulp-watch')
const sourcemaps = require('gulp-sourcemaps')
const sequence = require('run-sequence')
const postcss = require('gulp-postcss')
const plumber = require('gulp-plumber')
const gulpif = require('gulp-if')
const log = require('log-utils')
const cssnext = require('postcss-cssnext')
const cssnano = require('cssnano')({ autoprefixer: false })
const data = require('gulp-data')
const fm = require('front-matter')
const rev = require('gulp-rev')
const revReplace = require('gulp-rev-replace')
const del = require('del')
const webpack = require('webpack-stream')
const named = require('vinyl-named')
const layouts = require('handlebars-layouts')
const fs = require('fs')
const webpackConfig = require('./webpack.config')
const pkg = require('./package.json')

const paths = {
  src: { root: 'src' },
  dist: { root: 'dist' },
  init: function () {
    this.src.sass = `${this.src.root}/scss/index.scss`
    this.src.templates = `${this.src.root}/**/*.hbs`
    this.src.js = [`${this.src.root}/js/**/*.js`, `!${this.src.root}/js/libs/*.js`]
    this.src.libs = `${this.src.root}/js/libs/*.js`
    this.src.static = `${this.src.root}/static/**/*.*`
    this.src.CNAME = `${this.src.root}/CNAME`
    this.src._redircts = `${this.src.root}/_redirects`
    this.src.files = `${this.src.root}/*.{html,txt,xml}`
    this.dist.css = `${this.dist.root}/css`
    this.dist.static = `${this.dist.root}/static`
    this.dist.js = `${this.dist.root}/js`
    this.dist.libs = `${this.dist.root}/js/libs`

    return this
  }
}.init()

const handleError = function (error) {
  console.log(
    log.red(`${log.symbol.error} Error (${error.plugin}): ${error.message}`)
  )
  this.emit('end')
}

// Browsersync
gulp.task('serve', function () {
  browserSync.init({
    server: paths.dist.root,
    open: false,
    notify: false,
    online: false,
    logFileChanges: false,
    logPrefix: pkg.name
  })
})

// Hash CSS and JS
gulp.task('rev', function () {
  return gulp.src([`${paths.dist.css}/*.css`, `${paths.dist.js}/*.js`], {base: paths.dist.root})
    .pipe(gulp.dest(paths.dist.root))
    .pipe(rev())
    .pipe(gulp.dest(paths.dist.root))
    .pipe(rev.manifest())
    .pipe(gulp.dest(paths.dist.root))
})

// Re-write paths to rev'd CSS and JS
gulp.task('revreplace', ['rev'], function () {
  const manifest = gulp.src(`./${paths.dist.root}/rev-manifest.json`)
  return gulp.src(`./${paths.dist.root}/**/*.html`)
    .pipe(revReplace({manifest: manifest}))
    .pipe(gulp.dest(paths.dist.root))
})

// Styles (Sass)
gulp.task('styles', function () {
  const plugins = [
    cssnext(),
    cssnano
  ]
  return gulp.src([paths.src.sass])
    .pipe(gulpif(devBuild, plumber(handleError)))
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: ['src/scss']
    }))
    .pipe(postcss(plugins))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.dist.css))
    .pipe(browserSync.reload({stream: true}))
})

// Compile handlebars/partials into html
gulp.task('templates', function () {
  return gulp.src([paths.src.root + '/**/*.hbs', '!**/_*.hbs', `!${paths.src.root}/partials/**`])
    .pipe(gulpif(devBuild, plumber(handleError)))
    .pipe(
      data(function () {
        return JSON.parse(fs.readFileSync('./src/data/globals.json'))
      })
    )
    .pipe(
      data(function (file) {
        const content = fm(String(file.contents))
        file.contents = Buffer.from(content.body)
        return content.attributes
      })
    )
    .pipe(handlebars({ debug: false })
      .partials('./src/partials/**/*.hbs'))
    .helpers(layouts)
    .helpers(`./${paths.src.root}/helpers/**/*.js`)
    .data('./src/data/**/*.{js,json}')
    .pipe(rename({
      extname: '.html'
    }))
    .pipe(gulp.dest(paths.dist.root))
    .pipe(browserSync.reload({stream: true}))
})

// Bundle JS (Webpack & Babel)
gulp.task('scripts:bundle', function () {
  return gulp.src('./src/js/*.js')
    .pipe(gulpif(devBuild, plumber(handleError)))
    .pipe(named())
    .pipe(webpack(webpackConfig))
    .pipe(gulp.dest(paths.dist.js))
    .pipe(browserSync.reload({stream: true}))
})

// Minify vendor libs
gulp.task('scripts:libs', function () {
  return gulp.src([paths.src.libs])
    .pipe(uglify())
    .pipe(gulp.dest(paths.dist.libs))
    .pipe(browserSync.reload({stream: true}))
})

// Copy Static Assets
gulp.task('copy:static', function () {
  return gulp.src([paths.src.static])
    .pipe(gulp.dest(paths.dist.static))
    .pipe(browserSync.reload({stream: true}))
})

// Copy Static HTML and TXT
gulp.task('copy:files', function () {
  return gulp.src([paths.src.files, paths.src.CNAME, paths.src._redircts])
    .pipe(gulp.dest(paths.dist.root))
    .pipe(browserSync.reload({stream: true}))
})

// Delete Dist
gulp.task('clean', function () {
  return del([paths.dist.root])
})

// Watch
gulp.task('watch', function () {
  watch(paths.src.static, function () {
    gulp.start('copy:static')
  })
  watch(paths.src.files, function () {
    gulp.start('copy:files')
  })
  watch(`${paths.src.root}/data/**`, function () {
    gulp.start('templates')
  })
  gulp.watch('src/scss/**/*.scss', ['styles'])
  gulp.watch(paths.src.js, ['scripts:bundle'])
  gulp.watch(paths.src.libs, ['scripts:libs'])
  gulp.watch(paths.src.templates, ['templates'])
})

// Default task
gulp.task('default', ['watch', 'serve', 'copy:static', 'copy:files', 'styles', 'scripts:libs', 'scripts:bundle', 'templates'])

// Production Build
gulp.task('build', function (callback) {
  sequence(
    'clean',
    ['copy:static', 'copy:files', 'styles', 'scripts:libs', 'scripts:bundle', 'templates'],
    'revreplace',
    callback
  )
})
