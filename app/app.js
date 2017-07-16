'use strict';

angular
  .module('SlickChatApp', [
      'firebase',
      'angular-md5',
      'ui.router',
      'ngResource',
      'luegg.directives'
  ])
  .config(function ($stateProvider, $urlRouterProvider,FirebaseConfig,$locationProvider) {
      $locationProvider.html5Mode({
          enabled: true,
          requireBase: false
      });
    $stateProvider
      .state('home', {
          url: '/',
          templateUrl: 'app/home/home.html',
          resolve: {
              requireNoAuth: function($state,cognitoService){
                  var userPool = cognitoService.getUserPool();
                  var currentUser = userPool.getCurrentUser();
                  if(currentUser !== null){
                      $state.go('channels');
                  }
              }
          }
      })
      .state('login', {
          url: '/login',
          controller: 'LoginCtrl as loginCtrl',
          templateUrl: 'app/auth/login/login.html',
          resolve: {
              requireNoAuth: function($state,cognitoService){
                  var userPool = cognitoService.getUserPool();
                  var currentUser = userPool.getCurrentUser();
                  if(currentUser !== null){
                      $state.go('channels.welcome');
                  }
              }
          }
      }).state('register', {
          url: '/register',
          controller: 'RegisterCtrl as registerCtrl',
          templateUrl: 'app/auth/register/register.html',
          resolve: {
               requireNoAuth: function($state,cognitoService){
                   var userPool = cognitoService.getUserPool();
                   var currentUser = userPool.getCurrentUser();
                   if(currentUser !== null){
                       $state.go('channels');
                   }
               }
          }
      }).state('activate', {
        url: '/activate',
        controller: 'ActivateCtrl as activateCtrl',
        templateUrl: 'app/auth/activate/activate.html',
        resolve: {
                requireNoAuth: function($state, cognitoService){
                    var userPool = cognitoService.getUserPool();
                    var currentUser = userPool.getCurrentUser();
                    if(currentUser !== null){
                        $state.go('channels');
                    }
                }
        },
        params: {
            email: null,
            password: null
        }
    }).state('profile', {
        url: '/profile',
        controller: 'ProfileCtrl as profileCtrl',
        templateUrl: 'app/users/profile.html',
        resolve: {
            auth: function($state, Users, Auth){
                return Auth.$requireSignIn().catch(function(){
                    $state.go('home');
                });
            },
            profile: function(Users, Auth){
                return Auth.$requireSignIn().then(function(auth){
                    return Users.getProfile(auth.uid).$loaded();
                });
            }
        }
    }).state('channels', {
        url: '/channels',
        controller: 'ChannelsCtrl as channelsCtrl',
        templateUrl: 'app/channels/channelIndex.html',
        resolve: {
            requireAuth: function($state,cognitoService,$stateParams,$q){
                var params = $stateParams;
                var deferred = $q.defer();
                if(params.activation){
                    //console.log("email: "+ params.email);
                    var cognitoUser = cognitoService.getUser(params.email);
                    var authenticationDetails = cognitoService.getAuthenticationDetails(params.email, params.password);

                    cognitoUser.authenticateUser(authenticationDetails, {
                        onSuccess: function (result) {
                            deferred.resolve(result);
                            //console.log(result);
                            //console.log("Logged In ");
                        },
                        onFailure: function (err) {
                            console.log(err);
                        }
                    });
                    return deferred.promise;
                }else{
                    var userPool = cognitoService.getUserPool();
                    var currentUser = userPool.getCurrentUser();
                        //console.log(currentUser);
                    if(currentUser === null){
                        $state.go('home');
                    }
                }
            },
            channels: function (socket,$q) {
                var channelsList = [];
                socket.emit('getChannelsList');
                //console.log("hii in channel load ...request send");
                function loadChannels(){
                    var deferred = $q.defer();
                    console.log("getting something");
                    socket.on('ChannelsListReceived',function (data) {
                        //console.log(data);
                        //console.log("hii in channel request complete");
                        channelsList = data.channelList;
                        deferred.resolve(data);
                    });
                    return deferred.promise;
                }
                 return loadChannels().then(function(data){
                    return data;
                });
            },
            userDetailsAndMessages: function ($state,cognitoService,$q,md5,socket) {

                var details = {
                    userDetails:{},
                    userList:[],
                    userMessages:{}
                };

                function getUserMessages(){
                    var deferredMessage = $q.defer();
                   // console.log("getting something");
                    socket.on('initMessages',function (data) {
                    //    console.log(data);
                        details.userMessages = data.messages;
                        details.userList = data.userList;
                    //    console.log("hii in message request complete");
                        deferredMessage.resolve(data);
                    });
                    return deferredMessage.promise;
                }
                function getUserDetails() {
                    var deferred = $q.defer();
                    var userPool = cognitoService.getUserPool();
                    var currentUser = userPool.getCurrentUser();
                    function getSession() {
                        var sessioninit = $q.defer();
                        currentUser.getSession(function(err, session) {
                            if (err) {
                                console.log(err);
                            }
                            console.log('session validity: ' + session.isValid());
                            sessioninit.resolve(session);
                        });
                        return sessioninit.promise
                    }
                    getSession().then(function () {
                        currentUser.getUserAttributes(function(err, result) {
                            if (err) {
                                console.log(err);
                                //$state.go('home');
                            }
                            for (var i = 0; i < result.length; i++) {
                                if(result[i].getName() === "name"){
                                    details.userDetails.name = result[i].getValue();
                                    details.userDetails.displayName = details.userDetails.name.split(' ')[0];
                                }
                                if(result[i].getName() === "email"){
                                    details.userDetails.email = result[i].getValue();
                                    details.userDetails.getGravatar = '//www.gravatar.com/avatar/' + md5.createHash(details.userDetails.email) + '?d=retro';
                                }
                            }
                            deferred.resolve(result);
                            //console.log(channelsCtrl.allUser);
                            socket.emit('init', {
                                name: details.userDetails.displayName,
                                userImage:details.userDetails.getGravatar
                            });

                            details.userMessages = getUserMessages().then(function (data) {
                                return data;
                            });
                            // console.log(details.userMessages);

                        });
                    });

                    return deferred.promise;
                }

                return getUserDetails().then(function () {
                    return details
                })
            }
        },
        params: {
            email: null,
            password: null,
            activation: false,
            messageType: null,
            channelMessages: []
        }
    }).state('channels.welcome', {
        url: '',
        templateUrl: 'app/channels/home/welcome.html',
        controller: 'ChannelsCtrl as channelsCtrl',
        resolve:  {
            requireAuth: function($state,cognitoService,$stateParams){
                var params = $stateParams;
                if(params.activation){
                    //console.log("email: "+ params.email);
                    var cognitoUser = cognitoService.getUser(params.email);
                    var authenticationDetails = cognitoService.getAuthenticationDetails(params.email, params.password);

                    cognitoUser.authenticateUser(authenticationDetails, {
                        onSuccess: function (result) {
                            //console.log(result);
                            params.activation = false;
                            //console.log("Logged In ");
                            $state.go('channels.welcome');
                        },
                        onFailure: function (err) {
                            $state.go('home');
                        }
                    });
                }
                var userPool = cognitoService.getUserPool();
                var currentUser = userPool.getCurrentUser();

                //console.log("Logged In");
                if(currentUser === null){
                    $state.go('home');
                }
            }
        }
    }).state('channels.create', {
        url: '',
        templateUrl: 'app/channels/channels/create.html',
        controller: 'ChannelsCtrl as channelsCtrl',
        resolve:{

        }
    }).state('channels.direct', {
        url: '#{channelName}',
        templateUrl: 'app/channels/messages/messages.html',
        controller: 'MessagesCtrl as messagesCtrl',
        resolve: {
            // messages: function($stateParams, Messages, profile){
            //     return Messages.forUsers($stateParams.uid, profile.$id).$loaded();
            // },
            // channelName: function($stateParams, Users){
            //     return Users.all.$loaded().then(function(){
            //         return '@'+Users.getDisplayName($stateParams.uid);
            //     });
            // }
        }
    });

    firebase.initializeApp(FirebaseConfig);
    $urlRouterProvider.otherwise('/');
  })
    .constant('FirebaseConfig', {
        apiKey: 'AIzaSyDXYKlcoWu21K4-vQOuy7eqD3fOYn7WImw',
        authDomain: 'slackclone-830fc.firebaseapp.com',
        databaseURL: 'https://slackclone-830fc.firebaseio.com/'
    });
