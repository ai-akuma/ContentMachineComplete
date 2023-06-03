import { Injectable } from '@angular/core';
import { NavigationService } from '../navigation.service';
import { Observable, Subject, catchError, map, of } from 'rxjs';
import { FirebaseUser } from '../../model/user/user.model';
import { FireAuthRepository } from '../../repository/firebase/fireauth.repo';
import { User } from '@angular/fire/auth';
import { FirestoreRepository, PURCHASED_USERS_COL, USERS_COL } from 'src/app/repository/firebase/firestore.repo';
import { DocumentReference } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private errorSubject = new Subject<string>();

  constructor(
    private fireAuthRepo: FireAuthRepository,
    private firestoreRepo: FirestoreRepository,
    private navigationService: NavigationService
  ) {
    this.fireAuthRepo.getUserAuthObservable().subscribe((user) => {
      // will reinsert if needed later
      // this.setUserData(user);
    });
  }

  checkForAuthLoginRedirect() {
    if (this.fireAuthRepo.sessionUser !== null) {
      this.navigationService.navigateToDashboard();
      return;
    }

    this.fireAuthRepo.getUserAuthObservable().subscribe({
      next: (user) => {
        if (user !== null) {
          // this.navService.navigateToList();
        }
      },
      error: (error) => {
        console.log('🔥' + error);
        this.errorSubject.next(error);
      },
    });
  }

  checkForAuthLogoutRedirect() {
    if (this.fireAuthRepo.sessionUser === null) {
      console.log(
        '🚀 ~ file: session.service.ts:35 ~ SessionService ~ this.fireAuthRepo.getUserAuthObservable ~ user:',
        this.fireAuthRepo.sessionUser
      );
      // this.navService.navigateToLander();
      return;
    } else {
      // this.navService.navigateToList();
    }
  }

  verifyPurchaseEmail(email: string): Observable<boolean> {
    return this.firestoreRepo.getUsersDocument(PURCHASED_USERS_COL, email).pipe(
      map((doc) => {
        if (doc !== undefined) {
          return true;
        } else {
          console.debug('No such document!');
          return false;
        }
      })
    );
  }

  getErrorObserver(): Observable<string> {
    return this.errorSubject.asObservable();
  }

  getProfilePic(): string {
    return (
      this.fireAuthRepo.sessionUser?.photoURL ?? 'https://placehold.co/48x48'
    );
  }

  getAuthStateObserver(): Observable<FirebaseUser> {
    return this.fireAuthRepo.getUserAuthObservable();
  }

  verifyEmail(authUser: User) {
    const email = authUser.email;
    // const isFirstTimeUser = signinSuccessData.authResult.additionalUserInfo?.isNewUser;

    if (email !== undefined && email !== '') {
      this.verifyPurchaseEmail(email!!).subscribe({
        next: (userExists) => {
          if (userExists) {
            console.log(
              '🚀 ~ file: session.service.ts:104 ~ SessionService ~ this.fireAuthRepo.verifyPurchaseEmail ~ userExists:',
              userExists
            );
            this.setUserData({
              ...authUser?.toJSON(),
              // isVirgin: isFirstTimeUser,
            });
            //
            this.navigationService.navigateToDashboard();
            //
          } else {
            this.fireAuthRepo.signOut();
            this.errorSubject.next(
              'You are not authorized to use this application. Please contact us.'
            );
          }
        },
        error: (error) => {
          console.debug('🔥' + error);
          this.fireAuthRepo.signOut();
          this.errorSubject.next(error);
        },
      });
    } else {
      this.errorSubject.next(
        "We couldn't create your account. Please contact us."
      );
    }
  }

  /* Setting up user data when sign in with username/password,
   * sign up with username/password and sign in with social auth
   * provider in Firestore database using AngularFirestore + AngularFirestoreDocument service
   */
  async setUserData(user: any) {
    // const existingUserRef = this.angularFirestore.doc(
    //   `${USERS_COL}/${user.uid}`
    // );
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      // isVirgin: user.isVirgin,
    };

    // Check if the user document exists
    this.firestoreRepo.getUsersDocument<DocumentReference>(USERS_COL, user.uid).subscribe((doc: DocumentReference) => {
      if (doc !== undefined) {
        console.log("🚀 ~ file: session.service.ts:144 ~ SessionService ~ this.firestoreRepo.getUsersDocument<DocumentReference> ~ doc:", doc)
        // User exists, update the existing user data
        // userData.isVirgin = false;
        this.firestoreRepo.updateUsersDocument(USERS_COL, user.uid, userData);
      } else {
        console.log("🚀 ~ file: session.service.ts:149 ~ SessionService ~ this.firestoreRepo.getUsersDocument<DocumentReference> ~ doc:", 'doc doesnt exist')
        // User doesn't exist, create a new user document
        this.firestoreRepo.createUsersDocument(USERS_COL, userData, user.uid);
      }
    });
  }
}
