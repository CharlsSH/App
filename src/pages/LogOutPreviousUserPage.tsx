import type {StackScreenProps} from '@react-navigation/stack';
import React, {useContext, useEffect} from 'react';
import {Linking, NativeModules} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import InitialUrlContext from '@libs/InitialUrlContext';
import Navigation from '@navigation/Navigation';
import type {AuthScreensParamList} from '@navigation/types';
import * as SessionActions from '@userActions/Session';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {Account, Session} from '@src/types/onyx';

type LogOutPreviousUserPageOnyxProps = {
    /** The data about the current session which will be set once the user is authenticated and we return to this component as an AuthScreen */
    session: OnyxEntry<Session>;
    account: OnyxEntry<Account>;
};

type LogOutPreviousUserPageProps = LogOutPreviousUserPageOnyxProps & StackScreenProps<AuthScreensParamList, typeof SCREENS.TRANSITION_BETWEEN_APPS>;

// This page is responsible for handling transitions from OldDot. Specifically, it logs the current user
// out if the transition is for another user.
//
// This component should not do any other navigation as that handled in App.setUpPoliciesAndNavigate
function LogOutPreviousUserPage({session, route, account}: LogOutPreviousUserPageProps) {
    const initUrl = useContext(InitialUrlContext);
    useEffect(() => {
        Linking.getInitialURL().then((url) => {
            const sessionEmail = session?.email;
            const transitionURL = NativeModules.HybridAppModule ? CONST.DEEPLINK_BASE_URL + initUrl : url;

            // TODO: Fix isLoggingInAsNewUser
            const isLoggingInAsNewUser = false;

            if (isLoggingInAsNewUser) {
                SessionActions.signOutAndRedirectToSignIn();
            }

            // We need to signin and fetch a new authToken, if a user was already authenticated in NewDot, and was redirected to OldDot
            // and their authToken stored in Onyx becomes invalid.
            // This workflow is triggered while setting up VBBA. User is redirected from NewDot to OldDot to set up 2FA, and then redirected back to NewDot
            // On Enabling 2FA, authToken stored in Onyx becomes expired and hence we need to fetch new authToken
            const shouldForceLogin = route.params.shouldForceLogin === 'true';
            if (shouldForceLogin) {
                const email = route.params.email ?? '';
                const shortLivedAuthToken = route.params.shortLivedAuthToken ?? '';
                SessionActions.signInWithShortLivedAuthToken(email, shortLivedAuthToken);
            }
            const exitTo = route.params.exitTo as Route | null;
            // We don't want to navigate to the exitTo route when creating a new workspace from a deep link,
            // because we already handle creating the optimistic policy and navigating to it in App.setUpPoliciesAndNavigate,
            // which is already called when AuthScreens mounts.
            if (exitTo && exitTo !== ROUTES.WORKSPACE_NEW && !account?.isLoading && !isLoggingInAsNewUser) {
                Navigation.isNavigationReady().then(() => {
                    // remove this screen and navigate to exit route
                    const exitUrl = NativeModules.HybridAppModule ? Navigation.parseHybridAppUrl(exitTo) : exitTo;
                    Navigation.goBack();
                    Navigation.navigate(exitUrl);
                });
            }
        });
    }, [initUrl, account, route, session]);

    return <FullScreenLoadingIndicator />;
}

LogOutPreviousUserPage.displayName = 'LogOutPreviousUserPage';

export default withOnyx<LogOutPreviousUserPageProps, LogOutPreviousUserPageOnyxProps>({
    account: {key: ONYXKEYS.ACCOUNT},
    session: {
        key: ONYXKEYS.SESSION,
    },
})(LogOutPreviousUserPage);
