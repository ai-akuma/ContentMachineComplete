import { Injectable } from '@angular/core';
import {
  FacebookAuthProvider,
  getAuth,
  GoogleAuthProvider,
  OAuthCredential,
  signInWithCredential,
  signInWithPopup,
  TwitterAuthProvider,
} from 'firebase/auth';
import {
  catchError,
  concatMap,
  from,
  map,
  Observable,
  Subject,
  switchMap,
} from 'rxjs';
import {
  FirestoreRepository,
  USERS_COL,
} from '../repository/firebase/firestore.repo';
import { firebase } from 'firebaseui-angular';
import {
  USER_SOCIAL_MEDIA_HANDLES_DOC,
  USER_OAUTH_2_KEYS_DOC,
  PostingPlatform,
} from '../repository/firebase/firestore.repo';
import {
  ACCESS_TOKEN,
  LAST_LOGIN_AT,
  CREATION_TIME,
  REFRESH_TOKEN,
  SCOPE as SCOPES,
} from '../repository/firebase/firestore.repo';
import { FireAuthRepository } from '../repository/firebase/fireauth.repo';
import { YoutubeAuthRepository } from '../repository/youtubeauth.repo';

@Injectable({
  providedIn: 'root',
})
export class SocialAccountService {
  private auth = getAuth();

  private googleProvider = new GoogleAuthProvider();
  private facebookProvider = new FacebookAuthProvider();
  private twitterProvider = new TwitterAuthProvider();

  private facebookAuthSubject = new Subject<boolean>();
  private mediumAuthSubject = new Subject<boolean>();
  private twitterAuthSubject = new Subject<boolean>();
  private linkedinAuthSubject = new Subject<boolean>();

  private conectionsLoadingSubject = new Subject<boolean>();
  private errorSubject = new Subject<string>();

  private googleScopes = [];
  private facebookScopes = [];
  private mediumScopes = [];
  private twitterScopes = [
    'tweet.read',
    'tweet.write',
    'tweet.delete',
    'follows.write',
  ];
  private youtubeScopes = [];

  constructor(
    private fireAuthRepo: FireAuthRepository,
    private firestoreRepo: FirestoreRepository,
    private youtubeAuthRepo: YoutubeAuthRepository
  ) {
    this.facebookProvider.addScope('user_birthday');
    this.facebookProvider.setCustomParameters({
      display: 'popup',
    });
  }

  getFacebookAuthObservable$ = this.facebookAuthSubject.asObservable();
  getMediumAuthObservable$ = this.mediumAuthSubject.asObservable();
  getTwitterAuthObservable$ = this.twitterAuthSubject.asObservable();
  getLinkedinAuthObservable$ = this.linkedinAuthSubject.asObservable();

  getConnectionLoadingObservable$ =
    this.conectionsLoadingSubject.asObservable();
  getErrorObservable$ = this.errorSubject.asObservable();

  getYoutubeAuthObservable$: Observable<boolean> =
    this.youtubeAuthRepo.tokenResponseObserver$.pipe(
      map((tokenResponse) => {
        const oAuth2Payload = {
          [ACCESS_TOKEN]: tokenResponse,
        };

        this.firestoreRepo.updateCurrentUserCollectionDocument(
          USER_OAUTH_2_KEYS_DOC,
          PostingPlatform.YOUTUBE,
          oAuth2Payload
        );
        console.log(
          '🚀 ~ file: socialaccount.service.ts:74 ~ SocialAccountService ~ map ~ tokenResponse:',
          tokenResponse
        );
        return tokenResponse;
      }),
      concatMap((tokenResponse) =>
        this.youtubeAuthRepo.getChannels(tokenResponse)
      ),
      concatMap((channelResponse) => {
        console.log(
          '🚀 ~ file: socialaccount.service.ts:76 ~ SocialAccountService ~ channelResponse:',
          channelResponse
        );
        return this.firestoreRepo.updateCurrentUserDocument({
          [USER_SOCIAL_MEDIA_HANDLES_DOC]: {
            [PostingPlatform.YOUTUBE]: channelResponse[0].displayName || '',
          },
        });
      }),
      map((channelResponse) => {
        return channelResponse;
      })
    );

  signInWithGoogle(): Observable<any> {
    return new Observable((subscriber) => {
      signInWithPopup(this.auth, this.googleProvider)
        .then((result) => {
          // This gives you a Google Access Token. You can use it to access the Google API.
          const credential = GoogleAuthProvider.credentialFromResult(result);
          // const token = credential.accessToken;

          // The signed-in user info.
          const user = result.user;
          const sessionUser = {
            ...user,
            google_credentials: credential,
          };
          subscriber.next(sessionUser);
          // IdP data available using getAdditionalUserInfo(result)
          // ...
        })
        .catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.customData.email;
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);

          subscriber.error(credential);
          // ...
        });
    });
  }

  /**
   * This is not working except in HTTPS published
   */
  signInWithFacebook() {
    signInWithPopup(this.auth, this.facebookProvider)
      .then((result) => {
        // The signed-in user info.
        const user = result.user;
        console.log(
          '🚀 ~ file: socialaccount.service.ts:39 ~ SocialAccountService ~ .then ~ user:',
          user
        );

        // This gives you a Facebook Access Token. You can use it to access the Facebook API.
        const credential = FacebookAuthProvider.credentialFromResult(result);

        if (credential !== null) {
          const accessToken = credential.accessToken;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:48 ~ SocialAccountService ~ .then ~ accessToken:',
            accessToken
          );

          // If we have credentials we will sign in explicityly to Facebook so we can get a long-lived token
          // If you need to continuously use the Facebook API, use option 2 as Firebase does not manage OAuth
          //tokens after they expire. If you just need Facebook data on sign-in, then use option 1.
          firebase
            .auth()
            .signInWithCredential(credential)
            .then((userCredential) => {
              console.log(
                '🚀 ~ file: socialaccount.service.ts:51 ~ SocialAccountService ~ firebase.auth ~ userCredential:',
                userCredential
              );
            })
            .catch((error) => {
              console.log(
                '🚀 ~ file: socialaccount.service.ts:53 ~ SocialAccountService ~ firebase.auth ~ error:',
                error
              );
            });
        }

        // IdP data available using getAdditionalUserInfo(result)
        // ...
      })
      .catch((error) => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        // The email of the user's account used.
        const email = error.customData.email;
        // The AuthCredential type that was used.
        const credential = FacebookAuthProvider.credentialFromError(error);
        // ...
      });
  }

  signInWithMedium() {
    // this.socialAuthService.signIn(MediumLoginProvider.PROVIDER_ID);
  }

  signInWithTwitter() {
    this.conectionsLoadingSubject.next(true);
    from(signInWithPopup(this.auth, this.twitterProvider))
      .pipe(
        map((result) => {
          const resultUser = result.user;
          // This gives you a the Twitter OAuth 1.0 Access Token and Secret.
          // You can use these server side with your app's credentials to access the Twitter API.
          const credential = TwitterAuthProvider.credentialFromResult(result);
          if (credential !== null) {
            const token = credential.accessToken;
            const secret = credential.secret;

            this.firestoreRepo.updateCurrentUserDocument({
              [USER_SOCIAL_MEDIA_HANDLES_DOC]: {
                [PostingPlatform.TWITTER]: resultUser?.displayName || '',
              },
            });

            const oAuth2Payload = {
              [ACCESS_TOKEN]: token,
              [REFRESH_TOKEN]: secret,
              [SCOPES]: this.twitterScopes,
              [LAST_LOGIN_AT]: resultUser.metadata.lastSignInTime,
              [CREATION_TIME]: resultUser.metadata.creationTime,
            };

            this.firestoreRepo.updateCurrentUserCollectionDocument(
              USER_OAUTH_2_KEYS_DOC,
              PostingPlatform.TWITTER,
              oAuth2Payload
            );
          } else {
            console.log(
              '🔥 ~ file: socialaccount.service.ts:126 ~ SocialAccountService ~ .then ~ oAuth2Payload:',
              'credential error'
            );
            this.errorSubject.next('Twitter Auth Error');
          }

          // The signed-in user info.
          const user = result.user;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:134 ~ SocialAccountService ~ .then ~ user:',
            user
          );
          // IdP data available using getAdditionalUserInfo(result)
          // ...
        }),
        concatMap((result) => {
          const currentUser = this.fireAuthRepo.currentSessionUser;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:205 ~ SocialAccountService ~ concatMap ~ currentUser:',
            currentUser
          );
          if (currentUser === undefined) {
            throw new Error('No current user');
          }
          return this.firestoreRepo.getUsersDocument(
            USERS_COL,
            currentUser?.uid
          );
        }),
        concatMap((userDoc: any) => {
          console.log(
            '🚀 ~ file: socialaccount.service.ts:212 ~ SocialAccountService ~ concatMap ~ userDoc:',
            userDoc
          );
          const constidToken = userDoc?.idToken;
          // Build Firebase credential with the Google ID token.
          const credential = GoogleAuthProvider.credential(constidToken);
          console.log(
            '🚀 ~ file: socialaccount.service.ts:216 ~ SocialAccountService ~ map ~ credential:',
            credential
          );
          return signInWithCredential(this.auth, credential);
        })
      )
      .subscribe({
        next: (result) => {
          this.conectionsLoadingSubject.next(false);
        },
        error: (error) => {
          // Handle Errors here.
          const errorCode = error.code;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:224 ~ SocialAccountService ~ signInWithTwitter ~ errorCode:',
            errorCode
          );
          const errorMessage = error.message;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:226 ~ SocialAccountService ~ signInWithTwitter ~ errorMessage:',
            errorMessage
          );
          // The email of the user's account used.
          const email = error.customData.email;
          console.log(
            '🚀 ~ file: socialaccount.service.ts:229 ~ SocialAccountService ~ signInWithTwitter ~ email:',
            error.customData
          );
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);
          console.log(
            '🚀 ~ file: socialaccount.service.ts:211 ~ SocialAccountService ~ map ~ credential:',
            credential
          );

          this.twitterAuthSubject.next(true);
          this.conectionsLoadingSubject.next(false);
          this.errorSubject.next(errorMessage);
        },
      });
  }

  signInWithYoutube() {
    // this.socialAuthService.signIn(YoutubeLoginProvider.PROVIDER_ID);
  }

  signInWithLinkedin() {
    // this.socialAuthService.signIn(LinkedinLoginProvider.PROVIDER_ID);
  }
}