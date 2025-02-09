import {format} from 'date-fns';
import {ExpensiMark, Str} from 'expensify-common';
import {isEmpty} from 'lodash';
import lodashEscape from 'lodash/escape';
import lodashFindLastIndex from 'lodash/findLastIndex';
import lodashIntersection from 'lodash/intersection';
import lodashIsEqual from 'lodash/isEqual';
import type {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type {FileObject} from '@components/AttachmentModal';
import {FallbackAvatar} from '@components/Icon/Expensicons';
import * as defaultGroupAvatars from '@components/Icon/GroupDefaultAvatars';
import * as defaultWorkspaceAvatars from '@components/Icon/WorkspaceDefaultAvatars';
import type {MoneyRequestAmountInputProps} from '@components/MoneyRequestAmountInput';
import type {IOUAction, IOUType} from '@src/CONST';
import CONST from '@src/CONST';
import type {ParentNavigationSummaryParams, TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type {
    Beta,
    PersonalDetails,
    PersonalDetailsList,
    Policy,
    PolicyReportField,
    Report,
    ReportAction,
    ReportMetadata,
    ReportNameValuePairs,
    Session,
    Task,
    Transaction,
    TransactionViolation,
    UserWallet,
} from '@src/types/onyx';
import type {Participant} from '@src/types/onyx/IOU';
import type {Errors, Icon, PendingAction} from '@src/types/onyx/OnyxCommon';
import type {
    ChangeLog,
    IOUMessage,
    OriginalMessageActionName,
    OriginalMessageCreated,
    OriginalMessageDismissedViolation,
    OriginalMessageReimbursementDequeued,
    OriginalMessageRenamed,
    PaymentMethodType,
    ReimbursementDeQueuedMessage,
} from '@src/types/onyx/OriginalMessage';
import type {Status} from '@src/types/onyx/PersonalDetails';
import type {NotificationPreference, Participants, PendingChatMember, Participant as ReportParticipant} from '@src/types/onyx/Report';
import type {Message, ReportActionBase, ReportActions, ReportPreviewAction} from '@src/types/onyx/ReportAction';
import type {Comment, Receipt, TransactionChanges, WaypointCollection} from '@src/types/onyx/Transaction';
import type {EmptyObject} from '@src/types/utils/EmptyObject';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';
import * as IOU from './actions/IOU';
import * as PolicyActions from './actions/Policy/Policy';
import * as store from './actions/ReimbursementAccount/store';
import * as CurrencyUtils from './CurrencyUtils';
import DateUtils from './DateUtils';
import {hasValidDraftComment} from './DraftCommentUtils';
import originalGetReportPolicyID from './getReportPolicyID';
import isReportMessageAttachment from './isReportMessageAttachment';
import localeCompare from './LocaleCompare';
import * as LocalePhoneNumber from './LocalePhoneNumber';
import * as Localize from './Localize';
import {isEmailPublicDomain} from './LoginUtils';
import ModifiedExpenseMessage from './ModifiedExpenseMessage';
import linkingConfig from './Navigation/linkingConfig';
import Navigation from './Navigation/Navigation';
import * as NumberUtils from './NumberUtils';
import Permissions from './Permissions';
import * as PersonalDetailsUtils from './PersonalDetailsUtils';
import * as PhoneNumber from './PhoneNumber';
import * as PolicyUtils from './PolicyUtils';
import type {LastVisibleMessage} from './ReportActionsUtils';
import * as ReportActionsUtils from './ReportActionsUtils';
import StringUtils from './StringUtils';
import * as TransactionUtils from './TransactionUtils';
import * as Url from './Url';
import type {AvatarSource} from './UserUtils';
import * as UserUtils from './UserUtils';

type AvatarRange = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;

type WelcomeMessage = {showReportName: boolean; phrase1?: string; phrase2?: string};

type ExpenseOriginalMessage = {
    oldComment?: string;
    newComment?: string;
    comment?: string;
    merchant?: string;
    oldCreated?: string;
    created?: string;
    oldMerchant?: string;
    oldAmount?: number;
    amount?: number;
    oldCurrency?: string;
    currency?: string;
    category?: string;
    oldCategory?: string;
    tag?: string;
    oldTag?: string;
    billable?: string;
    oldBillable?: string;
    oldTaxAmount?: number;
    taxAmount?: number;
    taxRate?: string;
    oldTaxRate?: string;
};

type SpendBreakdown = {
    nonReimbursableSpend: number;
    reimbursableSpend: number;
    totalDisplaySpend: number;
};

type ParticipantDetails = [number, string, AvatarSource, AvatarSource];

type OptimisticAddCommentReportAction = Pick<
    ReportAction,
    | 'reportActionID'
    | 'actionName'
    | 'actorAccountID'
    | 'person'
    | 'automatic'
    | 'avatar'
    | 'created'
    | 'message'
    | 'isFirstItem'
    | 'isAttachment'
    | 'attachmentInfo'
    | 'pendingAction'
    | 'shouldShow'
    | 'originalMessage'
    | 'childReportID'
    | 'parentReportID'
    | 'childType'
    | 'childReportName'
    | 'childManagerAccountID'
    | 'childStatusNum'
    | 'childStateNum'
    | 'errors'
    | 'childVisibleActionCount'
    | 'childCommenterCount'
    | 'childLastVisibleActionCreated'
    | 'childOldestFourAccountIDs'
> & {isOptimisticAction: boolean};

type OptimisticReportAction = {
    commentText: string;
    reportAction: OptimisticAddCommentReportAction;
};

type UpdateOptimisticParentReportAction = {
    childVisibleActionCount: number;
    childCommenterCount: number;
    childLastVisibleActionCreated: string;
    childOldestFourAccountIDs: string | undefined;
};

type OptimisticExpenseReport = Pick<
    Report,
    | 'reportID'
    | 'chatReportID'
    | 'policyID'
    | 'type'
    | 'ownerAccountID'
    | 'managerID'
    | 'currency'
    | 'reportName'
    | 'stateNum'
    | 'statusNum'
    | 'total'
    | 'nonReimbursableTotal'
    | 'notificationPreference'
    | 'parentReportID'
    | 'lastVisibleActionCreated'
>;

type OptimisticIOUReportAction = Pick<
    ReportAction,
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachment'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
    | 'receipt'
    | 'childReportID'
    | 'childVisibleActionCount'
    | 'childCommenterCount'
>;

type ReportRouteParams = {
    reportID: string;
    isSubReportPageRoute: boolean;
};

type ReportOfflinePendingActionAndErrors = {
    reportPendingAction: PendingAction | undefined;
    reportErrors: Errors | null | undefined;
};

type OptimisticApprovedReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachment' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticSubmittedReportAction = Pick<
    ReportAction,
    | 'actionName'
    | 'actorAccountID'
    | 'adminAccountID'
    | 'automatic'
    | 'avatar'
    | 'isAttachment'
    | 'originalMessage'
    | 'message'
    | 'person'
    | 'reportActionID'
    | 'shouldShow'
    | 'created'
    | 'pendingAction'
>;

type OptimisticHoldReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'isAttachment' | 'originalMessage' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticCancelPaymentReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'message' | 'originalMessage' | 'person' | 'reportActionID' | 'shouldShow' | 'created' | 'pendingAction'
>;

type OptimisticEditedTaskReportAction = Pick<
    ReportAction,
    'reportActionID' | 'actionName' | 'pendingAction' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'shouldShow' | 'message' | 'person'
>;

type OptimisticClosedReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'originalMessage' | 'pendingAction' | 'person' | 'reportActionID' | 'shouldShow'
>;

type OptimisticDismissedViolationReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'avatar' | 'created' | 'message' | 'originalMessage' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction'
>;

type OptimisticCreatedReportAction = OriginalMessageCreated &
    Pick<ReportActionBase, 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction'>;

type OptimisticRenamedReportAction = OriginalMessageRenamed &
    Pick<ReportActionBase, 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'message' | 'person' | 'reportActionID' | 'shouldShow' | 'pendingAction'>;

type OptimisticChatReport = Pick<
    Report,
    | 'type'
    | 'chatType'
    | 'chatReportID'
    | 'iouReportID'
    | 'isOwnPolicyExpenseChat'
    | 'isPinned'
    | 'lastActorAccountID'
    | 'lastMessageTranslationKey'
    | 'lastMessageHtml'
    | 'lastMessageText'
    | 'lastReadTime'
    | 'lastVisibleActionCreated'
    | 'notificationPreference'
    | 'oldPolicyName'
    | 'ownerAccountID'
    | 'pendingFields'
    | 'parentReportActionID'
    | 'parentReportID'
    | 'participants'
    | 'policyID'
    | 'reportID'
    | 'reportName'
    | 'stateNum'
    | 'statusNum'
    | 'visibility'
    | 'description'
    | 'writeCapability'
    | 'avatarUrl'
    | 'invoiceReceiver'
    | 'isHidden'
> & {
    isOptimisticReport: true;
};

type OptimisticTaskReportAction = Pick<
    ReportAction,
    | 'reportActionID'
    | 'actionName'
    | 'actorAccountID'
    | 'automatic'
    | 'avatar'
    | 'created'
    | 'isAttachment'
    | 'message'
    | 'originalMessage'
    | 'person'
    | 'pendingAction'
    | 'shouldShow'
    | 'isFirstItem'
    | 'previousMessage'
    | 'errors'
    | 'linkMetadata'
>;

type OptimisticWorkspaceChats = {
    announceChatReportID: string;
    announceChatData: OptimisticChatReport;
    announceReportActionData: Record<string, OptimisticCreatedReportAction>;
    announceCreatedReportActionID: string;
    adminsChatReportID: string;
    adminsChatData: OptimisticChatReport;
    adminsReportActionData: Record<string, OptimisticCreatedReportAction>;
    adminsCreatedReportActionID: string;
    expenseChatReportID: string;
    expenseChatData: OptimisticChatReport;
    expenseReportActionData: Record<string, OptimisticCreatedReportAction>;
    expenseCreatedReportActionID: string;
};

type OptimisticModifiedExpenseReportAction = Pick<
    ReportAction,
    'actionName' | 'actorAccountID' | 'automatic' | 'avatar' | 'created' | 'isAttachment' | 'message' | 'originalMessage' | 'person' | 'pendingAction' | 'reportActionID' | 'shouldShow'
> & {reportID?: string};

type OptimisticTaskReport = Pick<
    Report,
    | 'reportID'
    | 'reportName'
    | 'description'
    | 'ownerAccountID'
    | 'participants'
    | 'managerID'
    | 'type'
    | 'parentReportID'
    | 'policyID'
    | 'stateNum'
    | 'statusNum'
    | 'notificationPreference'
    | 'parentReportActionID'
    | 'lastVisibleActionCreated'
>;

type TransactionDetails = {
    created: string;
    amount: number;
    taxAmount?: number;
    taxCode?: string;
    currency: string;
    merchant: string;
    waypoints?: WaypointCollection | string;
    comment: string;
    category: string;
    billable: boolean;
    tag: string;
    mccGroup?: ValueOf<typeof CONST.MCC_GROUPS>;
    cardID: number;
    originalAmount: number;
    originalCurrency: string;
};

type OptimisticIOUReport = Pick<
    Report,
    | 'cachedTotal'
    | 'type'
    | 'chatReportID'
    | 'currency'
    | 'managerID'
    | 'policyID'
    | 'ownerAccountID'
    | 'participants'
    | 'reportID'
    | 'stateNum'
    | 'statusNum'
    | 'total'
    | 'reportName'
    | 'notificationPreference'
    | 'parentReportID'
    | 'lastVisibleActionCreated'
>;
type DisplayNameWithTooltips = Array<Pick<PersonalDetails, 'accountID' | 'pronouns' | 'displayName' | 'login' | 'avatar'>>;

type CustomIcon = {
    src: IconAsset;
    color?: string;
};

type OptionData = {
    text?: string;
    alternateText?: string;
    allReportErrors?: Errors;
    brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS> | '' | null;
    tooltipText?: string | null;
    alternateTextMaxLines?: number;
    boldStyle?: boolean;
    customIcon?: CustomIcon;
    subtitle?: string;
    login?: string;
    accountID?: number;
    pronouns?: string;
    status?: Status | null;
    phoneNumber?: string;
    isUnread?: boolean | null;
    isUnreadWithMention?: boolean | null;
    hasDraftComment?: boolean | null;
    keyForList?: string;
    searchText?: string;
    isIOUReportOwner?: boolean | null;
    isArchivedRoom?: boolean | null;
    shouldShowSubscript?: boolean | null;
    isPolicyExpenseChat?: boolean | null;
    isMoneyRequestReport?: boolean | null;
    isInvoiceReport?: boolean;
    isExpenseRequest?: boolean | null;
    isAllowedToComment?: boolean | null;
    isThread?: boolean | null;
    isTaskReport?: boolean | null;
    parentReportAction?: OnyxEntry<ReportAction>;
    displayNamesWithTooltips?: DisplayNameWithTooltips | null;
    isDefaultRoom?: boolean;
    isInvoiceRoom?: boolean;
    isExpenseReport?: boolean;
    isOptimisticPersonalDetail?: boolean;
    selected?: boolean;
    isOptimisticAccount?: boolean;
    isSelected?: boolean;
    descriptiveText?: string;
    notificationPreference?: NotificationPreference | null;
    isDisabled?: boolean | null;
    name?: string | null;
    isSelfDM?: boolean;
    isOneOnOneChat?: boolean;
    reportID?: string;
    enabled?: boolean;
    code?: string;
    transactionThreadReportID?: string | null;
    shouldShowAmountInput?: boolean;
    amountInputProps?: MoneyRequestAmountInputProps;
    tabIndex?: 0 | -1;
} & Report;

type OnyxDataTaskAssigneeChat = {
    optimisticData: OnyxUpdate[];
    successData: OnyxUpdate[];
    failureData: OnyxUpdate[];
    optimisticAssigneeAddComment?: OptimisticReportAction;
    optimisticChatCreatedReportAction?: OptimisticCreatedReportAction;
};

type Ancestor = {
    report: Report;
    reportAction: ReportAction;
    shouldDisplayNewMarker: boolean;
};

type AncestorIDs = {
    reportIDs: string[];
    reportActionsIDs: string[];
};

type MissingPaymentMethod = 'bankAccount' | 'wallet';

type OutstandingChildRequest = {
    hasOutstandingChildRequest?: boolean;
};

type ParsingDetails = {
    shouldEscapeText?: boolean;
    reportID?: string;
};

let currentUserEmail: string | undefined;
let currentUserPrivateDomain: string | undefined;
let currentUserAccountID: number | undefined;
let isAnonymousUser = false;

// This cache is used to save parse result of report action html message into text
// to prevent unnecessary parsing when the report action is not changed/modified.
// Example case: when we need to get a report name of a thread which is dependent on a report action message.
const parsedReportActionMessageCache: Record<string, string> = {};

const defaultAvatarBuildingIconTestID = 'SvgDefaultAvatarBuilding Icon';

Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        // When signed out, val is undefined
        if (!value) {
            return;
        }

        currentUserEmail = value.email;
        currentUserAccountID = value.accountID;
        isAnonymousUser = value.authTokenType === CONST.AUTH_TOKEN_TYPES.ANONYMOUS;
        currentUserPrivateDomain = isEmailPublicDomain(currentUserEmail ?? '') ? '' : Str.extractEmailDomain(currentUserEmail ?? '');
    },
});

let allPersonalDetails: OnyxCollection<PersonalDetails>;
let allPersonalDetailLogins: string[];
let currentUserPersonalDetails: OnyxEntry<PersonalDetails>;
Onyx.connect({
    key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    callback: (value) => {
        currentUserPersonalDetails = value?.[currentUserAccountID ?? -1] ?? null;
        allPersonalDetails = value ?? {};
        allPersonalDetailLogins = Object.values(allPersonalDetails).map((personalDetail) => personalDetail?.login ?? '');
    },
});

let allReports: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (value) => (allReports = value),
});

let allReportsDraft: OnyxCollection<Report>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_DRAFT,
    waitForCollectionCallback: true,
    callback: (value) => (allReportsDraft = value),
});

let allPolicies: OnyxCollection<Policy>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    waitForCollectionCallback: true,
    callback: (value) => (allPolicies = value),
});

let allBetas: OnyxEntry<Beta[]>;
Onyx.connect({
    key: ONYXKEYS.BETAS,
    callback: (value) => (allBetas = value),
});

let allTransactions: OnyxCollection<Transaction> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allTransactions = Object.fromEntries(Object.entries(value).filter(([, transaction]) => transaction));
    },
});

let allReportActions: OnyxCollection<ReportActions>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    waitForCollectionCallback: true,
    callback: (actions) => {
        if (!actions) {
            return;
        }
        allReportActions = actions;
    },
});

let lastUpdatedReport: OnyxEntry<Report>;

Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    callback: (value) => {
        if (!value) {
            return;
        }

        lastUpdatedReport = value;
    },
});

function getLastUpdatedReport(): OnyxEntry<Report> {
    return lastUpdatedReport;
}

function getCurrentUserAvatar(): AvatarSource | undefined {
    return currentUserPersonalDetails?.avatar;
}

function getCurrentUserDisplayNameOrEmail(): string | undefined {
    return currentUserPersonalDetails?.displayName ?? currentUserEmail;
}

function getChatType(report: OnyxEntry<Report> | Participant | EmptyObject): ValueOf<typeof CONST.REPORT.CHAT_TYPE> | undefined {
    return report?.chatType;
}

/**
 * Get the report given a reportID
 */
function getReport(reportID: string | undefined): OnyxEntry<Report> {
    if (!allReports && !allReportsDraft) {
        return null;
    }

    const report = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    const draftReport = allReportsDraft?.[`${ONYXKEYS.COLLECTION.REPORT_DRAFT}${reportID}`];

    return report ?? draftReport ?? null;
}

/**
 * Check if a report is a draft report
 */
function isDraftReport(reportID: string | undefined): boolean {
    const draftReport = allReportsDraft?.[`${ONYXKEYS.COLLECTION.REPORT_DRAFT}${reportID}`];

    return !!draftReport;
}

/**
 * Returns the parentReport if the given report is a thread
 */
function getParentReport(report: OnyxEntry<Report> | EmptyObject): OnyxEntry<Report> | EmptyObject {
    if (!report?.parentReportID) {
        return {};
    }
    return allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report.parentReportID}`] ?? {};
}

/**
 * Returns the root parentReport if the given report is nested.
 * Uses recursion to iterate any depth of nested reports.
 */
function getRootParentReport(report: OnyxEntry<Report> | undefined | EmptyObject): OnyxEntry<Report> | EmptyObject {
    if (!report) {
        return {};
    }

    // Returns the current report as the root report, because it does not have a parentReportID
    if (!report?.parentReportID) {
        return report;
    }

    const parentReport = getReport(report?.parentReportID);

    // Runs recursion to iterate a parent report
    return getRootParentReport(!isEmptyObject(parentReport) ? parentReport : null);
}

/**
 * Returns the policy of the report
 */
function getPolicy(policyID: string | undefined): Policy | EmptyObject {
    if (!allPolicies || !policyID) {
        return {};
    }
    return allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`] ?? {};
}

/**
 * Get the policy type from a given report
 * @param policies must have Onyxkey prefix (i.e 'policy_') for keys
 */
function getPolicyType(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): string {
    return policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.type ?? '';
}

/**
 * Get the policy name from a given report
 */
function getPolicyName(report: OnyxEntry<Report> | undefined | EmptyObject, returnEmptyIfNotFound = false, policy: OnyxEntry<Policy> | undefined = undefined): string {
    const noPolicyFound = returnEmptyIfNotFound ? '' : Localize.translateLocal('workspace.common.unavailable');
    if (isEmptyObject(report)) {
        return noPolicyFound;
    }

    if ((!allPolicies || Object.keys(allPolicies).length === 0) && !report?.policyName) {
        return Localize.translateLocal('workspace.common.unavailable');
    }
    const finalPolicy = policy ?? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];

    const parentReport = getRootParentReport(report);

    // Rooms send back the policy name with the reportSummary,
    // since they can also be accessed by people who aren't in the workspace
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const policyName = finalPolicy?.name || report?.policyName || report?.oldPolicyName || parentReport?.oldPolicyName || noPolicyFound;

    return policyName;
}

/**
 * Returns the concatenated title for the PrimaryLogins of a report
 */
function getReportParticipantsTitle(accountIDs: number[]): string {
    // Somehow it's possible for the logins coming from report.participantAccountIDs to contain undefined values so we use .filter(Boolean) to remove them.
    return accountIDs.filter(Boolean).join(', ');
}

/**
 * Checks if a report is a chat report.
 */
function isChatReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return report?.type === CONST.REPORT.TYPE.CHAT;
}

function isInvoiceReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return report?.type === CONST.REPORT.TYPE.INVOICE;
}

/**
 * Checks if a report is an Expense report.
 */
function isExpenseReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return report?.type === CONST.REPORT.TYPE.EXPENSE;
}

/**
 * Checks if a report is an IOU report using report or reportID
 */
function isIOUReport(reportOrID: OnyxEntry<Report> | string | EmptyObject): boolean {
    const report = typeof reportOrID === 'string' ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`] ?? null : reportOrID;
    return report?.type === CONST.REPORT.TYPE.IOU;
}

/**
 * Checks if a report is an IOU report using report
 */
function isIOUReportUsingReport(report: OnyxEntry<Report> | EmptyObject): report is Report {
    return report?.type === CONST.REPORT.TYPE.IOU;
}
/**
 * Checks if a report is a task report.
 */
function isTaskReport(report: OnyxEntry<Report>): boolean {
    return report?.type === CONST.REPORT.TYPE.TASK;
}

/**
 * Checks if a task has been cancelled
 * When a task is deleted, the parentReportAction is updated to have a isDeletedParentAction deleted flag
 * This is because when you delete a task, we still allow you to chat on the report itself
 * There's another situation where you don't have access to the parentReportAction (because it was created in a chat you don't have access to)
 * In this case, we have added the key to the report itself
 */
function isCanceledTaskReport(report: OnyxEntry<Report> | EmptyObject = {}, parentReportAction: OnyxEntry<ReportAction> | EmptyObject = {}): boolean {
    if (!isEmptyObject(parentReportAction) && (parentReportAction?.message?.[0]?.isDeletedParentAction ?? false)) {
        return true;
    }

    if (!isEmptyObject(report) && report?.isDeletedParentAction) {
        return true;
    }

    return false;
}

/**
 * Checks if a report is an open task report.
 *
 * @param parentReportAction - The parent report action of the report (Used to check if the task has been canceled)
 */
function isOpenTaskReport(report: OnyxEntry<Report>, parentReportAction: OnyxEntry<ReportAction> | EmptyObject = {}): boolean {
    return (
        isTaskReport(report) && !isCanceledTaskReport(report, parentReportAction) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN
    );
}

/**
 * Checks if a report is a completed task report.
 */
function isCompletedTaskReport(report: OnyxEntry<Report>): boolean {
    return isTaskReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED && report?.statusNum === CONST.REPORT.STATUS_NUM.APPROVED;
}

/**
 * Checks if the current user is the manager of the supplied report
 */
function isReportManager(report: OnyxEntry<Report>): boolean {
    return Boolean(report && report.managerID === currentUserAccountID);
}

/**
 * Checks if the supplied report has been approved
 */
function isReportApproved(reportOrID: OnyxEntry<Report> | string | EmptyObject): boolean {
    const report = typeof reportOrID === 'string' ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`] ?? null : reportOrID;
    return report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED && report?.statusNum === CONST.REPORT.STATUS_NUM.APPROVED;
}

/**
 * Checks if the supplied report is an expense report in Open state and status.
 */
function isOpenExpenseReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return isExpenseReport(report) && report?.stateNum === CONST.REPORT.STATE_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

/**
 * Checks if the supplied report has a member with the array passed in params.
 */
function hasParticipantInArray(report: OnyxEntry<Report>, memberAccountIDs: number[]) {
    if (!report?.participants) {
        return false;
    }

    const memberAccountIDsSet = new Set(memberAccountIDs);

    for (const accountID in report.participants) {
        if (memberAccountIDsSet.has(Number(accountID))) {
            return true;
        }
    }

    return false;
}

/**
 * Whether the Money Request report is settled
 */
function isSettled(reportID: string | undefined): boolean {
    if (!allReports || !reportID) {
        return false;
    }
    const report: Report | EmptyObject = allReports[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`] ?? {};
    if (isEmptyObject(report) || report.isWaitingOnBankAccount) {
        return false;
    }

    // In case the payment is scheduled and we are waiting for the payee to set up their wallet,
    // consider the report as paid as well.
    if (report.isWaitingOnBankAccount && report.statusNum === CONST.REPORT.STATUS_NUM.APPROVED) {
        return true;
    }

    return report?.statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED;
}

/**
 * Whether the current user is the submitter of the report
 */
function isCurrentUserSubmitter(reportID: string): boolean {
    if (!allReports) {
        return false;
    }
    const report = allReports[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
    return Boolean(report && report.ownerAccountID === currentUserAccountID);
}

/**
 * Whether the provided report is an Admin room
 */
function isAdminRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
}

/**
 * Whether the provided report is an Admin-only posting room
 */
function isAdminsOnlyPostingRoom(report: OnyxEntry<Report>): boolean {
    return report?.writeCapability === CONST.REPORT.WRITE_CAPABILITIES.ADMINS;
}

/**
 * Whether the provided report is a Announce room
 */
function isAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE;
}

/**
 * Whether the provided report is a default room
 */
function isDefaultRoom(report: OnyxEntry<Report>): boolean {
    return CONST.DEFAULT_POLICY_ROOM_CHAT_TYPES.some((type) => type === getChatType(report));
}

/**
 * Whether the provided report is a Domain room
 */
function isDomainRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL;
}

/**
 * Whether the provided report is a user created policy room
 */
function isUserCreatedPolicyRoom(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ROOM;
}

/**
 * Whether the provided report is a Policy Expense chat.
 */
function isPolicyExpenseChat(report: OnyxEntry<Report> | Participant | EmptyObject): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT || (report?.isPolicyExpenseChat ?? false);
}

function isInvoiceRoom(report: OnyxEntry<Report> | EmptyObject): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.INVOICE;
}

/**
 * Checks if a report is a completed task report.
 */
function isTripRoom(report: OnyxEntry<Report>): boolean {
    return isChatReport(report) && getChatType(report) === CONST.REPORT.CHAT_TYPE.TRIP_ROOM;
}

function isCurrentUserInvoiceReceiver(report: OnyxEntry<Report>): boolean {
    if (report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        return currentUserAccountID === report.invoiceReceiver.accountID;
    }

    return false;
}

/**
 * Whether the provided report belongs to a Control policy and is an expense chat
 */
function isControlPolicyExpenseChat(report: OnyxEntry<Report>): boolean {
    return isPolicyExpenseChat(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/**
 * Whether the provided policyType is a Free, Collect or Control policy type
 */
function isGroupPolicy(policyType: string): boolean {
    return policyType === CONST.POLICY.TYPE.CORPORATE || policyType === CONST.POLICY.TYPE.TEAM || policyType === CONST.POLICY.TYPE.FREE;
}

/**
 * Whether the provided report belongs to a Free, Collect or Control policy
 */
function isReportInGroupPolicy(report: OnyxEntry<Report>, policy?: OnyxEntry<Policy>): boolean {
    const policyType = policy?.type ?? getPolicyType(report, allPolicies);
    return isGroupPolicy(policyType);
}

/**
 * Whether the provided report belongs to a Control or Collect policy
 */
function isPaidGroupPolicy(report: OnyxEntry<Report>): boolean {
    const policyType = getPolicyType(report, allPolicies);
    return policyType === CONST.POLICY.TYPE.CORPORATE || policyType === CONST.POLICY.TYPE.TEAM;
}

/**
 * Whether the provided report belongs to a Control or Collect policy and is an expense chat
 */
function isPaidGroupPolicyExpenseChat(report: OnyxEntry<Report>): boolean {
    return isPolicyExpenseChat(report) && isPaidGroupPolicy(report);
}

/**
 * Whether the provided report belongs to a Control policy and is an expense report
 */
function isControlPolicyExpenseReport(report: OnyxEntry<Report>): boolean {
    return isExpenseReport(report) && getPolicyType(report, allPolicies) === CONST.POLICY.TYPE.CORPORATE;
}

/**
 * Whether the provided report belongs to a Control or Collect policy and is an expense report
 */
function isPaidGroupPolicyExpenseReport(report: OnyxEntry<Report>): boolean {
    return isExpenseReport(report) && isPaidGroupPolicy(report);
}

/**
 * Checks if the supplied report is an invoice report in Open state and status.
 */
function isOpenInvoiceReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return isInvoiceReport(report) && report?.statusNum === CONST.REPORT.STATUS_NUM.OPEN;
}

/**
 * Whether the provided report is a chat room
 */
function isChatRoom(report: OnyxEntry<Report>): boolean {
    return isUserCreatedPolicyRoom(report) || isDefaultRoom(report) || isInvoiceRoom(report);
}

/**
 * Whether the provided report is a public room
 */
function isPublicRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC || report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * Whether the provided report is a public announce room
 */
function isPublicAnnounceRoom(report: OnyxEntry<Report>): boolean {
    return report?.visibility === CONST.REPORT.VISIBILITY.PUBLIC_ANNOUNCE;
}

/**
 * If the report is a policy expense, the route should be for adding bank account for that policy
 * else since the report is a personal IOU, the route should be for personal bank account.
 */
function getBankAccountRoute(report: OnyxEntry<Report>): Route {
    return isPolicyExpenseChat(report) ? ROUTES.BANK_ACCOUNT_WITH_STEP_TO_OPEN.getRoute('', report?.policyID) : ROUTES.SETTINGS_ADD_BANK_ACCOUNT;
}

/**
 * Check if personal detail of accountID is empty or optimistic data
 */
function isOptimisticPersonalDetail(accountID: number): boolean {
    return isEmptyObject(allPersonalDetails?.[accountID]) || !!allPersonalDetails?.[accountID]?.isOptimisticPersonalDetail;
}

/**
 * Checks if a report is a task report from a policy expense chat.
 */
function isWorkspaceTaskReport(report: OnyxEntry<Report>): boolean {
    if (!isTaskReport(report)) {
        return false;
    }
    const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`] ?? null;
    return isPolicyExpenseChat(parentReport);
}

/**
 * Returns true if report has a parent
 */
function isThread(report: OnyxEntry<Report>): boolean {
    return Boolean(report?.parentReportID && report?.parentReportActionID);
}

/**
 * Returns true if report is of type chat and has a parent and is therefore a Thread.
 */
function isChatThread(report: OnyxEntry<Report>): boolean {
    return isThread(report) && report?.type === CONST.REPORT.TYPE.CHAT;
}

function isDM(report: OnyxEntry<Report>): boolean {
    return isChatReport(report) && !getChatType(report) && !isThread(report);
}

function isSelfDM(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.SELF_DM;
}

function isGroupChat(report: OnyxEntry<Report> | Partial<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.GROUP;
}

function isSystemChat(report: OnyxEntry<Report>): boolean {
    return getChatType(report) === CONST.REPORT.CHAT_TYPE.SYSTEM;
}

/**
 * Only returns true if this is our main 1:1 DM report with Concierge
 */
function isConciergeChatReport(report: OnyxEntry<Report>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    return participantAccountIDs.length === 1 && participantAccountIDs[0] === CONST.ACCOUNT_ID.CONCIERGE && !isChatThread(report);
}

function findSelfDMReportID(): string | undefined {
    if (!allReports) {
        return;
    }

    const selfDMReport = Object.values(allReports).find((report) => isSelfDM(report) && !isThread(report));
    return selfDMReport?.reportID;
}

/**
 * Checks if the supplied report belongs to workspace based on the provided params. If the report's policyID is _FAKE_ or has no value, it means this report is a DM.
 * In this case report and workspace members must be compared to determine whether the report belongs to the workspace.
 */
function doesReportBelongToWorkspace(report: OnyxEntry<Report>, policyMemberAccountIDs: number[], policyID?: string) {
    return (
        isConciergeChatReport(report) ||
        (report?.policyID === CONST.POLICY.ID_FAKE || !report?.policyID ? hasParticipantInArray(report, policyMemberAccountIDs) : report?.policyID === policyID)
    );
}

/**
 * Given an array of reports, return them filtered by a policyID and policyMemberAccountIDs.
 */
function filterReportsByPolicyIDAndMemberAccountIDs(reports: Report[], policyMemberAccountIDs: number[] = [], policyID?: string) {
    return reports.filter((report) => !!report && doesReportBelongToWorkspace(report, policyMemberAccountIDs, policyID));
}

/**
 * Given an array of reports, return them sorted by the last read timestamp.
 */
function sortReportsByLastRead(reports: Array<OnyxEntry<Report>>, reportMetadata: OnyxCollection<ReportMetadata>): Array<OnyxEntry<Report>> {
    return reports
        .filter((report) => !!report?.reportID && !!(reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${report.reportID}`]?.lastVisitTime ?? report?.lastReadTime))
        .sort((a, b) => {
            const aTime = new Date(reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${a?.reportID}`]?.lastVisitTime ?? a?.lastReadTime ?? '');
            const bTime = new Date(reportMetadata?.[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${b?.reportID}`]?.lastVisitTime ?? b?.lastReadTime ?? '');

            return aTime.valueOf() - bTime.valueOf();
        });
}

/**
 * Returns true if report is still being processed
 */
function isProcessingReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return report?.stateNum === CONST.REPORT.STATE_NUM.SUBMITTED && report?.statusNum === CONST.REPORT.STATUS_NUM.SUBMITTED;
}

/**
 * Check if the report is a single chat report that isn't a thread
 * and personal detail of participant is optimistic data
 */
function shouldDisableDetailPage(report: OnyxEntry<Report>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);

    if (isChatRoom(report) || isPolicyExpenseChat(report) || isChatThread(report) || isTaskReport(report)) {
        return false;
    }
    if (participantAccountIDs.length === 1) {
        return isOptimisticPersonalDetail(participantAccountIDs[0]);
    }
    return false;
}

/**
 * Returns true if this report has only one participant and it's an Expensify account.
 */
function isExpensifyOnlyParticipantInReport(report: OnyxEntry<Report>): boolean {
    const otherParticipants = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    return otherParticipants.length === 1 && otherParticipants.some((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
}

/**
 * Returns whether a given report can have tasks created in it.
 * We only prevent the task option if it's a DM/group-DM and the other users are all special Expensify accounts
 *
 */
function canCreateTaskInReport(report: OnyxEntry<Report>): boolean {
    const otherParticipants = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    const areExpensifyAccountsOnlyOtherParticipants = otherParticipants.length >= 1 && otherParticipants.every((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
    if (areExpensifyAccountsOnlyOtherParticipants && isDM(report)) {
        return false;
    }

    return true;
}

/**
 * Returns true if there are any guides accounts (team.expensify.com) in a list of accountIDs
 * by cross-referencing the accountIDs with personalDetails since guides that are participants
 * of the user's chats should have their personal details in Onyx.
 */
function hasExpensifyGuidesEmails(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => Str.extractEmailDomain(allPersonalDetails?.[accountID]?.login ?? '') === CONST.EMAIL.GUIDES_DOMAIN);
}

function findLastAccessedReport(
    reports: OnyxCollection<Report>,
    ignoreDomainRooms: boolean,
    policies: OnyxCollection<Policy>,
    isFirstTimeNewExpensifyUser: boolean,
    openOnAdminRoom = false,
    reportMetadata: OnyxCollection<ReportMetadata> = {},
    policyID?: string,
    policyMemberAccountIDs: number[] = [],
): OnyxEntry<Report> {
    // If it's the user's first time using New Expensify, then they could either have:
    //   - just a Concierge report, if so we'll return that
    //   - their Concierge report, and a separate report that must have deeplinked them to the app before they created their account.
    // If it's the latter, we'll use the deeplinked report over the Concierge report,
    // since the Concierge report would be incorrectly selected over the deep-linked report in the logic below.

    let reportsValues = Object.values(reports ?? {}) as Report[];

    if (!!policyID || policyMemberAccountIDs.length > 0) {
        reportsValues = filterReportsByPolicyIDAndMemberAccountIDs(reportsValues, policyMemberAccountIDs, policyID);
    }

    let sortedReports = sortReportsByLastRead(reportsValues, reportMetadata);

    let adminReport: OnyxEntry<Report> | undefined;
    if (openOnAdminRoom) {
        adminReport = sortedReports.find((report) => {
            const chatType = getChatType(report);
            return chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS;
        });
    }

    if (ignoreDomainRooms) {
        // We allow public announce rooms, admins, and announce rooms through since we bypass the default rooms beta for them.
        // Check where ReportUtils.findLastAccessedReport is called in MainDrawerNavigator.js for more context.
        // Domain rooms are now the only type of default room that are on the defaultRooms beta.
        sortedReports = sortedReports.filter(
            (report) => !isDomainRoom(report) || getPolicyType(report, policies) === CONST.POLICY.TYPE.FREE || hasExpensifyGuidesEmails(Object.keys(report?.participants ?? {}).map(Number)),
        );
    }

    if (isFirstTimeNewExpensifyUser) {
        // Filter out the systemChat report from the reports list, as we don't want to drop the user into that report over Concierge when they first log in
        sortedReports = sortedReports.filter((report) => !isSystemChat(report)) ?? [];
        if (sortedReports.length === 1) {
            return sortedReports[0];
        }

        return adminReport ?? sortedReports.find((report) => !isConciergeChatReport(report)) ?? null;
    }

    // If we only have two reports and one of them is the system chat, filter it out so we don't
    // overwrite showing the concierge chat
    const hasSystemChat = sortedReports.find((report) => isSystemChat(report)) ?? false;
    if (sortedReports.length === 2 && hasSystemChat) {
        sortedReports = sortedReports.filter((report) => !isSystemChat(report)) ?? [];
    }

    return adminReport ?? sortedReports.at(-1) ?? null;
}

/**
 * Whether the provided report has expenses
 */
function hasExpenses(reportID?: string): boolean {
    return !!Object.values(allTransactions ?? {}).find((transaction) => `${transaction?.reportID}` === `${reportID}`);
}

/**
 * Whether the provided report is a closed expense report with no expenses
 */
function isClosedExpenseReportWithNoExpenses(report: OnyxEntry<Report>): boolean {
    return report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED && isExpenseReport(report) && !hasExpenses(report.reportID);
}

/**
 * Whether the provided report is an archived room
 */
function isArchivedRoom(report: OnyxEntry<Report> | EmptyObject, reportNameValuePairs?: OnyxEntry<ReportNameValuePairs> | EmptyObject): boolean {
    if (reportNameValuePairs) {
        return reportNameValuePairs.isArchived;
    }

    return report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED && report?.stateNum === CONST.REPORT.STATE_NUM.APPROVED;
}

/**
 * Whether the provided report is a closed report
 */
function isClosedReport(report: OnyxEntry<Report> | EmptyObject): boolean {
    return report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED;
}

/**
 * Whether the provided report is the admin's room
 */
function isJoinRequestInAdminRoom(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }
    // If this policy isn't owned by Expensify,
    // Account manager/guide should not have the workspace join request pinned to their LHN,
    // since they are not a part of the company, and should not action it on their behalf.
    if (report.policyID) {
        const policy = getPolicy(report.policyID);
        if (!PolicyUtils.isExpensifyTeam(policy.owner) && PolicyUtils.isExpensifyTeam(currentUserPersonalDetails?.login)) {
            return false;
        }
    }
    return ReportActionsUtils.isActionableJoinRequestPending(report.reportID);
}

/**
 * Checks if the user can write in the provided report
 */
function canWriteInReport(report: OnyxEntry<Report>): boolean {
    if (Array.isArray(report?.permissions) && report?.permissions.length > 0) {
        return report?.permissions?.includes(CONST.REPORT.PERMISSIONS.WRITE);
    }

    return true;
}

/**
 * Checks if the current user is allowed to comment on the given report.
 */
function isAllowedToComment(report: OnyxEntry<Report>): boolean {
    if (!canWriteInReport(report)) {
        return false;
    }

    // Default to allowing all users to post
    const capability = report?.writeCapability ?? CONST.REPORT.WRITE_CAPABILITIES.ALL;

    if (capability === CONST.REPORT.WRITE_CAPABILITIES.ALL) {
        return true;
    }

    // If unauthenticated user opens public chat room using deeplink, they do not have policies available and they cannot comment
    if (!allPolicies) {
        return false;
    }

    // If we've made it here, commenting on this report is restricted.
    // If the user is an admin, allow them to post.
    const policy = allPolicies[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    return policy?.role === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy given the policy expense chat.
 */
function isPolicyExpenseChatAdmin(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>): boolean {
    if (!isPolicyExpenseChat(report)) {
        return false;
    }

    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.role;

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks if the current user is the admin of the policy.
 */
function isPolicyAdmin(policyID: string, policies: OnyxCollection<Policy>): boolean {
    const policyRole = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`]?.role;

    return policyRole === CONST.POLICY.ROLE.ADMIN;
}

/**
 * Checks whether all the transactions linked to the IOU report are of the Distance Request type with pending routes
 */
function hasOnlyTransactionsWithPendingRoutes(iouReportID: string | undefined): boolean {
    const transactions = TransactionUtils.getAllReportTransactions(iouReportID);

    // Early return false in case not having any transaction
    if (!transactions || transactions.length === 0) {
        return false;
    }

    return transactions.every((transaction) => TransactionUtils.isFetchingWaypointsFromServer(transaction));
}

/**
 * If the report is a thread and has a chat type set, it is a workspace chat.
 */
function isWorkspaceThread(report: OnyxEntry<Report>): boolean {
    const chatType = getChatType(report);
    return isThread(report) && isChatReport(report) && CONST.WORKSPACE_ROOM_TYPES.some((type) => chatType === type);
}

/**
 * Returns true if reportAction is the first chat preview of a Thread
 */
function isThreadFirstChat(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    return reportAction?.childReportID?.toString() === reportID;
}

/**
 * Checks if a report is a child report.
 */
function isChildReport(report: OnyxEntry<Report>): boolean {
    return isThread(report) || isTaskReport(report);
}

/**
 * An Expense Request is a thread where the parent report is an Expense Report and
 * the parentReportAction is a transaction.
 */
function isExpenseRequest(report: OnyxEntry<Report>): boolean {
    if (isThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`] ?? null;
        return isExpenseReport(parentReport) && !isEmptyObject(parentReportAction) && ReportActionsUtils.isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * An IOU Request is a thread where the parent report is an IOU Report and
 * the parentReportAction is a transaction.
 */
function isIOURequest(report: OnyxEntry<Report>): boolean {
    if (isThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`] ?? null;
        return isIOUReport(parentReport) && !isEmptyObject(parentReportAction) && ReportActionsUtils.isTransactionThread(parentReportAction);
    }
    return false;
}

/**
 * A Track Expense Report is a thread where the parent the parentReportAction is a transaction, and
 * parentReportAction has type of track.
 */
function isTrackExpenseReport(report: OnyxEntry<Report>): boolean {
    if (isThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        return !isEmptyObject(parentReportAction) && ReportActionsUtils.isTrackExpenseAction(parentReportAction);
    }
    return false;
}

/**
 * Checks if a report is an IOU or expense request.
 */
function isMoneyRequest(reportOrID: OnyxEntry<Report> | string): boolean {
    const report = typeof reportOrID === 'string' ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`] ?? null : reportOrID;
    return isIOURequest(report) || isExpenseRequest(report);
}

/**
 * Checks if a report is an IOU or expense report.
 */
function isMoneyRequestReport(reportOrID: OnyxEntry<Report> | EmptyObject | string): boolean {
    const report = typeof reportOrID === 'object' ? reportOrID : allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportOrID}`] ?? null;
    return isIOUReport(report) || isExpenseReport(report);
}

/**
 * Checks if a report has only one transaction associated with it
 */
function isOneTransactionReport(reportID: string): boolean {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] ?? ([] as ReportAction[]);
    return ReportActionsUtils.getOneTransactionThreadReportID(reportID, reportActions) !== null;
}

/**
 * Checks if a report is a transaction thread associated with a report that has only one transaction
 */
function isOneTransactionThread(reportID: string, parentReportID: string): boolean {
    const parentReportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${parentReportID}`] ?? ([] as ReportAction[]);
    const transactionThreadReportID = ReportActionsUtils.getOneTransactionThreadReportID(parentReportID, parentReportActions);
    return reportID === transactionThreadReportID;
}

/**
 * Should return true only for personal 1:1 report
 *
 */
function isOneOnOneChat(report: OnyxEntry<Report>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);
    return (
        !isChatRoom(report) &&
        !isExpenseRequest(report) &&
        !isMoneyRequestReport(report) &&
        !isPolicyExpenseChat(report) &&
        !isTaskReport(report) &&
        isDM(report) &&
        !isIOUReport(report) &&
        participantAccountIDs.length === 1
    );
}

/**
 * Checks if the current user is a payer of the expense
 */

function isPayer(session: OnyxEntry<Session>, iouReport: OnyxEntry<Report>) {
    const isApproved = isReportApproved(iouReport);
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${iouReport?.policyID}`] ?? null;
    const policyType = policy?.type;
    const isAdmin = policyType !== CONST.POLICY.TYPE.PERSONAL && policy?.role === CONST.POLICY.ROLE.ADMIN;
    const isManager = iouReport?.managerID === session?.accountID;
    if (isPaidGroupPolicy(iouReport)) {
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES) {
            const isReimburser = session?.email === policy?.achAccount?.reimburser;
            return (!policy?.achAccount?.reimburser || isReimburser) && (isApproved || isManager);
        }
        if (policy?.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_MANUAL) {
            return isAdmin && (isApproved || isManager);
        }
        return false;
    }
    return isAdmin || (isMoneyRequestReport(iouReport) && isManager);
}

/**
 * Get the notification preference given a report
 */
function getReportNotificationPreference(report: OnyxEntry<Report>): string | number {
    return report?.notificationPreference ?? '';
}

/**
 * Checks if the current user is the action's author
 */
function isActionCreator(reportAction: OnyxEntry<ReportAction> | Partial<ReportAction>): boolean {
    return reportAction?.actorAccountID === currentUserAccountID;
}

/**
 * Returns the notification preference of the action's child report if it exists.
 * Otherwise, calculates it based on the action's authorship.
 */
function getChildReportNotificationPreference(reportAction: OnyxEntry<ReportAction> | Partial<ReportAction>): NotificationPreference {
    const childReportNotificationPreference = reportAction?.childReportNotificationPreference ?? '';
    if (childReportNotificationPreference) {
        return childReportNotificationPreference;
    }

    return isActionCreator(reportAction) ? CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS : CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN;
}

/**
 * Checks whether the supplied report supports adding more transactions to it.
 * Return true if:
 * - report is a non-settled IOU
 * - report is a draft
 * - report is a processing expense report and its policy has Instant reporting frequency
 */
function canAddOrDeleteTransactions(moneyRequestReport: OnyxEntry<Report>): boolean {
    if (!isMoneyRequestReport(moneyRequestReport)) {
        return false;
    }

    if (isReportApproved(moneyRequestReport) || isSettled(moneyRequestReport?.reportID)) {
        return false;
    }

    if (isReportInGroupPolicy(moneyRequestReport) && isProcessingReport(moneyRequestReport) && !PolicyUtils.isInstantSubmitEnabled(getPolicy(moneyRequestReport?.policyID))) {
        return false;
    }

    return true;
}

/**
 * Can only delete if the author is this user and the action is an ADD_COMMENT action or an IOU action in an unsettled report, or if the user is a
 * policy admin
 */
function canDeleteReportAction(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    const report = getReport(reportID);

    const isActionOwner = reportAction?.actorAccountID === currentUserAccountID;
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`] ?? null;

    if (reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU) {
        // For now, users cannot delete split actions
        const isSplitAction = reportAction?.originalMessage?.type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT;

        if (isSplitAction) {
            return false;
        }

        const linkedReport = isThreadFirstChat(reportAction, reportID) ? getReport(report?.parentReportID) : report;
        if (isActionOwner) {
            if (!isEmptyObject(linkedReport) && isMoneyRequestReport(linkedReport)) {
                return canAddOrDeleteTransactions(linkedReport);
            }
            return true;
        }
    }

    if (
        reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT ||
        reportAction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE ||
        ReportActionsUtils.isCreatedTaskReportAction(reportAction) ||
        reportAction?.actorAccountID === CONST.ACCOUNT_ID.CONCIERGE
    ) {
        return false;
    }

    const isAdmin = policy?.role === CONST.POLICY.ROLE.ADMIN && !isEmptyObject(report) && !isDM(report);

    return isActionOwner || isAdmin;
}

/**
 * Get welcome message based on room type
 */
function getRoomWelcomeMessage(report: OnyxEntry<Report>, isUserPolicyAdmin: boolean): WelcomeMessage {
    const welcomeMessage: WelcomeMessage = {showReportName: true};
    const workspaceName = getPolicyName(report);

    if (isArchivedRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfArchivedRoomPartOne');
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfArchivedRoomPartTwo');
    } else if (isDomainRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryDomainRoomPartOne', {domainRoom: report?.reportName ?? ''});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryDomainRoomPartTwo');
    } else if (isAdminRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminRoomPartOne', {workspaceName});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminRoomPartTwo');
    } else if (isAdminsOnlyPostingRoom(report) && !isUserPolicyAdmin) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAdminOnlyPostingRoom');
        welcomeMessage.showReportName = false;
    } else if (isAnnounceRoom(report)) {
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAnnounceRoomPartOne', {workspaceName});
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryAnnounceRoomPartTwo', {workspaceName});
    } else if (isInvoiceRoom(report)) {
        welcomeMessage.showReportName = false;
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryInvoiceRoom');
    } else {
        // Message for user created rooms or other room types.
        welcomeMessage.phrase1 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryUserRoomPartOne');
        welcomeMessage.phrase2 = Localize.translateLocal('reportActionsView.beginningOfChatHistoryUserRoomPartTwo');
    }

    return welcomeMessage;
}

/**
 * Returns true if Concierge is one of the chat participants (1:1 as well as group chats)
 */
function chatIncludesConcierge(report: Partial<OnyxEntry<Report>>): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    return participantAccountIDs.includes(CONST.ACCOUNT_ID.CONCIERGE);
}

/**
 * Returns true if there is any automated expensify account `in accountIDs
 */
function hasAutomatedExpensifyAccountIDs(accountIDs: number[]): boolean {
    return accountIDs.some((accountID) => CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID));
}

function getReportRecipientAccountIDs(report: OnyxEntry<Report>, currentLoginAccountID: number): number[] {
    let finalReport: OnyxEntry<Report> = report;
    // In 1:1 chat threads, the participants will be the same as parent report. If a report is specifically a 1:1 chat thread then we will
    // get parent report and use its participants array.
    if (isThread(report) && !(isTaskReport(report) || isMoneyRequestReport(report))) {
        const parentReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`] ?? null;
        if (isOneOnOneChat(parentReport)) {
            finalReport = parentReport;
        }
    }

    let finalParticipantAccountIDs: number[] = [];
    if (isMoneyRequestReport(report)) {
        // For money requests i.e the IOU (1:1 person) and Expense (1:* person) reports, use the full `participants`
        // and add the `ownerAccountId`. Money request reports don't add `ownerAccountId` in `participants` array
        const defaultParticipantAccountIDs = Object.keys(finalReport?.participants ?? {}).map(Number);
        const setOfParticipantAccountIDs = new Set<number>(report?.ownerAccountID ? [...defaultParticipantAccountIDs, report.ownerAccountID] : defaultParticipantAccountIDs);
        finalParticipantAccountIDs = [...setOfParticipantAccountIDs];
    } else if (isTaskReport(report)) {
        // Task reports `managerID` will change when assignee is changed, in that case the old `managerID` is still present in `participants`
        // along with the new one. We only need the `managerID` as a participant here.
        finalParticipantAccountIDs = report?.managerID ? [report?.managerID] : [];
    } else {
        finalParticipantAccountIDs = Object.keys(finalReport?.participants ?? {}).map(Number);
    }

    const otherParticipantsWithoutExpensifyAccountIDs = finalParticipantAccountIDs.filter((accountID) => {
        if (accountID === currentLoginAccountID) {
            return false;
        }
        if (CONST.EXPENSIFY_ACCOUNT_IDS.includes(accountID)) {
            return false;
        }
        return true;
    });

    return otherParticipantsWithoutExpensifyAccountIDs;
}

/**
 * Whether the time row should be shown for a report.
 */
function canShowReportRecipientLocalTime(personalDetails: OnyxCollection<PersonalDetails>, report: OnyxEntry<Report>, accountID: number): boolean {
    const reportRecipientAccountIDs = getReportRecipientAccountIDs(report, accountID);
    const hasMultipleParticipants = reportRecipientAccountIDs.length > 1;
    const reportRecipient = personalDetails?.[reportRecipientAccountIDs[0]];
    const reportRecipientTimezone = reportRecipient?.timezone ?? CONST.DEFAULT_TIME_ZONE;
    const isReportParticipantValidated = reportRecipient?.validated ?? false;
    return Boolean(
        !hasMultipleParticipants &&
            !isChatRoom(report) &&
            !isPolicyExpenseChat(getRootParentReport(report)) &&
            reportRecipient &&
            reportRecipientTimezone?.selected &&
            isReportParticipantValidated,
    );
}

/**
 * Shorten last message text to fixed length and trim spaces.
 */
function formatReportLastMessageText(lastMessageText: string, isModifiedExpenseMessage = false): string {
    if (isModifiedExpenseMessage) {
        return String(lastMessageText).trim().replace(CONST.REGEX.LINE_BREAK, '').trim();
    }
    return StringUtils.lineBreaksToSpaces(String(lastMessageText).trim()).substring(0, CONST.REPORT.LAST_MESSAGE_TEXT_MAX_LENGTH).trim();
}

/**
 * Helper method to return the default avatar associated with the given login
 */
function getDefaultWorkspaceAvatar(workspaceName?: string): IconAsset {
    if (!workspaceName) {
        return defaultWorkspaceAvatars.WorkspaceBuilding;
    }

    // Remove all chars not A-Z or 0-9 including underscore
    const alphaNumeric = workspaceName
        .normalize('NFD')
        .replace(/[^0-9a-z]/gi, '')
        .toUpperCase();

    const workspace = `Workspace${alphaNumeric[0]}` as keyof typeof defaultWorkspaceAvatars;
    const defaultWorkspaceAvatar = defaultWorkspaceAvatars[workspace];

    return !alphaNumeric ? defaultWorkspaceAvatars.WorkspaceBuilding : defaultWorkspaceAvatar;
}

/**
 * Helper method to return the default avatar testID associated with the given login
 */
function getDefaultWorkspaceAvatarTestID(workspaceName: string): string {
    if (!workspaceName) {
        return defaultAvatarBuildingIconTestID;
    }

    // Remove all chars not A-Z or 0-9 including underscore
    const alphaNumeric = workspaceName
        .normalize('NFD')
        .replace(/[^0-9a-z]/gi, '')
        .toLowerCase();

    return !alphaNumeric ? defaultAvatarBuildingIconTestID : `SvgDefaultAvatar_${alphaNumeric[0]} Icon`;
}

function getWorkspaceAvatar(report: OnyxEntry<Report>): AvatarSource {
    const workspaceName = getPolicyName(report, false, allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]);
    const avatar = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.avatarURL ?? '';
    return !isEmpty(avatar) ? avatar : getDefaultWorkspaceAvatar(workspaceName);
}

/**
 * Helper method to return the default avatar associated with the given reportID
 */
function getDefaultGroupAvatar(reportID?: string): IconAsset {
    if (!reportID) {
        return defaultGroupAvatars.Avatar1;
    }
    const reportIDHashBucket: AvatarRange = ((Number(reportID) % CONST.DEFAULT_GROUP_AVATAR_COUNT) + 1) as AvatarRange;
    return defaultGroupAvatars[`Avatar${reportIDHashBucket}`];
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIconsForParticipants(participants: number[], personalDetails: OnyxCollection<PersonalDetails>): Icon[] {
    const participantDetails: ParticipantDetails[] = [];
    const participantsList = participants || [];

    for (const accountID of participantsList) {
        const avatarSource = personalDetails?.[accountID]?.avatar ?? FallbackAvatar;
        const displayNameLogin = personalDetails?.[accountID]?.displayName ? personalDetails?.[accountID]?.displayName : personalDetails?.[accountID]?.login;
        participantDetails.push([accountID, displayNameLogin ?? '', avatarSource, personalDetails?.[accountID]?.fallbackIcon ?? '']);
    }

    const sortedParticipantDetails = participantDetails.sort((first, second) => {
        // First sort by displayName/login
        const displayNameLoginOrder = localeCompare(first[1], second[1]);
        if (displayNameLoginOrder !== 0) {
            return displayNameLoginOrder;
        }

        // Then fallback on accountID as the final sorting criteria.
        // This will ensure that the order of avatars with same login/displayName
        // stay consistent across all users and devices
        return first[0] - second[0];
    });

    // Now that things are sorted, gather only the avatars (second element in the array) and return those
    const avatars: Icon[] = [];

    for (const sortedParticipantDetail of sortedParticipantDetails) {
        const userIcon = {
            id: sortedParticipantDetail[0],
            source: sortedParticipantDetail[2],
            type: CONST.ICON_TYPE_AVATAR,
            name: sortedParticipantDetail[1],
            fallbackIcon: sortedParticipantDetail[3],
        };
        avatars.push(userIcon);
    }

    return avatars;
}

/**
 * Given a report, return the associated workspace icon.
 */
function getWorkspaceIcon(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> = null): Icon {
    const workspaceName = getPolicyName(report, false, policy);
    const policyExpenseChatAvatarSource = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.avatarURL
        ? allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`]?.avatarURL
        : getDefaultWorkspaceAvatar(workspaceName);

    const workspaceIcon: Icon = {
        source: policyExpenseChatAvatarSource ?? '',
        type: CONST.ICON_TYPE_WORKSPACE,
        name: workspaceName,
        id: report?.policyID,
    };
    return workspaceIcon;
}

/**
 * Gets the personal details for a login by looking in the ONYXKEYS.PERSONAL_DETAILS_LIST Onyx key (stored in the local variable, allPersonalDetails). If it doesn't exist in Onyx,
 * then a default object is constructed.
 */
function getPersonalDetailsForAccountID(accountID: number): Partial<PersonalDetails> {
    if (!accountID) {
        return {};
    }

    const defaultDetails = {
        isOptimisticPersonalDetail: true,
    };

    return allPersonalDetails?.[accountID] ?? defaultDetails;
}

/**
 * Get the displayName for a single report participant.
 */
function getDisplayNameForParticipant(accountID?: number, shouldUseShortForm = false, shouldFallbackToHidden = true, shouldAddCurrentUserPostfix = false): string {
    if (!accountID) {
        return '';
    }

    const personalDetails = getPersonalDetailsForAccountID(accountID);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const formattedLogin = LocalePhoneNumber.formatPhoneNumber(personalDetails.login || '');
    // This is to check if account is an invite/optimistically created one
    // and prevent from falling back to 'Hidden', so a correct value is shown
    // when searching for a new user
    if (personalDetails.isOptimisticPersonalDetail === true) {
        return formattedLogin;
    }

    // For selfDM, we display the user's displayName followed by '(you)' as a postfix
    const shouldAddPostfix = shouldAddCurrentUserPostfix && accountID === currentUserAccountID;

    const longName = PersonalDetailsUtils.getDisplayNameOrDefault(personalDetails, formattedLogin, shouldFallbackToHidden, shouldAddPostfix);

    // If the user's personal details (first name) should be hidden, make sure we return "hidden" instead of the short name
    if (shouldFallbackToHidden && longName === Localize.translateLocal('common.hidden')) {
        return longName;
    }

    const shortName = personalDetails.firstName ? personalDetails.firstName : longName;
    return shouldUseShortForm ? shortName : longName;
}

function getParticipantAccountIDs(reportID: string, includeOnlyActiveMembers = false) {
    const report = getReport(reportID);
    if (!report || !report.participants) {
        return [];
    }
    const accountIDStrings = Object.keys(report.participants).filter((accountID) => {
        if (!includeOnlyActiveMembers) {
            return true;
        }
        const pendingMember = report?.pendingChatMembers?.findLast((member) => member.accountID === accountID.toString());
        return !pendingMember || pendingMember.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
    });
    return accountIDStrings.map((accountID) => Number(accountID));
}

function buildParticipantsFromAccountIDs(accountIDs: number[]): Participants {
    const finalParticipants: Participants = {};
    return accountIDs.reduce((participants, accountID) => {
        // eslint-disable-next-line no-param-reassign
        participants[accountID] = {hidden: false};
        return participants;
    }, finalParticipants);
}

/**
 * Returns the report name if the report is a group chat
 */
function getGroupChatName(participantAccountIDs?: number[], shouldApplyLimit = false, reportID = ''): string | undefined {
    // If we have a reportID always try to get the name from the report.
    if (reportID) {
        const reportKey = `${ONYXKEYS.COLLECTION.REPORT}${reportID}`;
        const reportName = allReports?.[reportKey]?.reportName;
        if (reportName) {
            return reportName;
        }
    }

    // Get participantAccountIDs from participants object
    let participants = participantAccountIDs ?? getParticipantAccountIDs(reportID);
    if (shouldApplyLimit) {
        participants = participants.slice(0, 5);
    }
    const isMultipleParticipantReport = participants.length > 1;

    if (isMultipleParticipantReport) {
        return participants
            .map((participant) => getDisplayNameForParticipant(participant, isMultipleParticipantReport))
            .sort((first, second) => localeCompare(first ?? '', second ?? ''))
            .filter(Boolean)
            .join(', ');
    }

    return Localize.translateLocal('groupChat.defaultReportName', {displayName: getDisplayNameForParticipant(participants[0], false)});
}

function getVisibleChatMemberAccountIDs(reportID: string): number[] {
    const report = getReport(reportID);
    if (!report || !report.participants) {
        return [];
    }
    const visibleParticipantAccountIDs = Object.entries(report.participants).reduce<number[]>((accountIDs, [accountID, participant]) => {
        if (participant && !participant.hidden) {
            accountIDs.push(Number(accountID));
        }
        return accountIDs;
    }, []);
    return visibleParticipantAccountIDs;
}

function getParticipants(reportID: string) {
    const report = getReport(reportID);
    if (!report) {
        return {};
    }

    return report.participants;
}

/**
 * Returns the appropriate icons for the given chat report using the stored personalDetails.
 * The Avatar sources can be URLs or Icon components according to the chat type.
 */
function getIcons(
    report: OnyxEntry<Report>,
    personalDetails: OnyxCollection<PersonalDetails>,
    defaultIcon: AvatarSource | null = null,
    defaultName = '',
    defaultAccountID = -1,
    policy: OnyxEntry<Policy> = null,
): Icon[] {
    if (isEmptyObject(report)) {
        const fallbackIcon: Icon = {
            source: defaultIcon ?? FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: defaultName,
            id: defaultAccountID,
        };
        return [fallbackIcon];
    }
    if (isExpenseRequest(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);
        const workspaceIcon = getWorkspaceIcon(report, policy);
        const memberIcon = {
            source: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.avatar ?? FallbackAvatar,
            id: parentReportAction.actorAccountID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.fallbackIcon,
        };

        return [memberIcon, workspaceIcon];
    }
    if (isChatThread(report)) {
        const parentReportAction = ReportActionsUtils.getParentReportAction(report);

        const actorAccountID = parentReportAction.actorAccountID;
        const actorDisplayName = PersonalDetailsUtils.getDisplayNameOrDefault(allPersonalDetails?.[actorAccountID ?? -1], '', false);
        const actorIcon = {
            id: actorAccountID,
            source: personalDetails?.[actorAccountID ?? -1]?.avatar ?? FallbackAvatar,
            name: actorDisplayName,
            type: CONST.ICON_TYPE_AVATAR,
            fallbackIcon: personalDetails?.[parentReportAction.actorAccountID ?? -1]?.fallbackIcon,
        };

        if (isWorkspaceThread(report)) {
            const workspaceIcon = getWorkspaceIcon(report, policy);
            return [actorIcon, workspaceIcon];
        }
        return [actorIcon];
    }
    if (isTaskReport(report)) {
        const ownerIcon = {
            id: report?.ownerAccountID,
            source: personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };

        if (isWorkspaceTaskReport(report)) {
            const workspaceIcon = getWorkspaceIcon(report, policy);
            return [ownerIcon, workspaceIcon];
        }

        return [ownerIcon];
    }
    if (isDomainRoom(report)) {
        // Get domain name after the #. Domain Rooms use our default workspace avatar pattern.
        const domainName = report?.reportName?.substring(1);
        const policyExpenseChatAvatarSource = getDefaultWorkspaceAvatar(domainName);
        const domainIcon: Icon = {
            source: policyExpenseChatAvatarSource,
            type: CONST.ICON_TYPE_WORKSPACE,
            name: domainName ?? '',
            id: report?.policyID,
        };
        return [domainIcon];
    }
    if (isAdminRoom(report) || isAnnounceRoom(report) || isChatRoom(report) || isArchivedRoom(report)) {
        const icons = [getWorkspaceIcon(report, policy)];

        if (isInvoiceRoom(report)) {
            if (report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
                icons.push(...getIconsForParticipants([report?.invoiceReceiver.accountID], personalDetails));
            } else {
                const receiverPolicy = getPolicy(report?.invoiceReceiver?.policyID);
                if (!isEmptyObject(receiverPolicy)) {
                    icons.push(getWorkspaceIcon(report, receiverPolicy));
                }
            }
        }

        return icons;
    }
    if (isPolicyExpenseChat(report) || isExpenseReport(report)) {
        const workspaceIcon = getWorkspaceIcon(report, policy);
        const memberIcon = {
            source: personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? FallbackAvatar,
            id: report?.ownerAccountID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };
        return isExpenseReport(report) ? [memberIcon, workspaceIcon] : [workspaceIcon, memberIcon];
    }
    if (isIOUReport(report)) {
        const managerIcon = {
            source: personalDetails?.[report?.managerID ?? -1]?.avatar ?? FallbackAvatar,
            id: report?.managerID,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.managerID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.managerID ?? -1]?.fallbackIcon,
        };
        const ownerIcon = {
            id: report?.ownerAccountID,
            source: personalDetails?.[report?.ownerAccountID ?? -1]?.avatar ?? FallbackAvatar,
            type: CONST.ICON_TYPE_AVATAR,
            name: personalDetails?.[report?.ownerAccountID ?? -1]?.displayName ?? '',
            fallbackIcon: personalDetails?.[report?.ownerAccountID ?? -1]?.fallbackIcon,
        };
        const isManager = currentUserAccountID === report?.managerID;

        // For one transaction IOUs, display a simplified report icon
        if (isOneTransactionReport(report?.reportID ?? '0')) {
            return [ownerIcon];
        }

        return isManager ? [managerIcon, ownerIcon] : [ownerIcon, managerIcon];
    }

    if (isSelfDM(report)) {
        return getIconsForParticipants([currentUserAccountID ?? 0], personalDetails);
    }

    if (isSystemChat(report)) {
        return getIconsForParticipants([CONST.ACCOUNT_ID.NOTIFICATIONS ?? 0], personalDetails);
    }

    if (isGroupChat(report)) {
        const groupChatIcon = {
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            source: report.avatarUrl || getDefaultGroupAvatar(report.reportID),
            id: -1,
            type: CONST.ICON_TYPE_AVATAR,
            name: getGroupChatName(undefined, true, report.reportID ?? ''),
        };
        return [groupChatIcon];
    }

    if (isInvoiceReport(report)) {
        const invoiceRoomReport = getReport(report.chatReportID);
        const icons = [getWorkspaceIcon(invoiceRoomReport, policy)];

        if (invoiceRoomReport?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
            icons.push(...getIconsForParticipants([invoiceRoomReport?.invoiceReceiver.accountID], personalDetails));

            return icons;
        }

        const receiverPolicy = getPolicy(invoiceRoomReport?.invoiceReceiver?.policyID);

        if (!isEmptyObject(receiverPolicy)) {
            icons.push(getWorkspaceIcon(invoiceRoomReport, receiverPolicy));
        }

        return icons;
    }

    if (isOneOnOneChat(report)) {
        const otherParticipantsAccountIDs = Object.keys(report.participants ?? {})
            .map(Number)
            .filter((accountID) => accountID !== currentUserAccountID);
        return getIconsForParticipants(otherParticipantsAccountIDs, personalDetails);
    }

    const participantAccountIDs = Object.keys(report.participants ?? {}).map(Number);
    return getIconsForParticipants(participantAccountIDs, personalDetails);
}

function getDisplayNamesWithTooltips(
    personalDetailsList: PersonalDetails[] | PersonalDetailsList | OptionData[],
    shouldUseShortForm: boolean,
    shouldFallbackToHidden = true,
    shouldAddCurrentUserPostfix = false,
): DisplayNameWithTooltips {
    const personalDetailsListArray = Array.isArray(personalDetailsList) ? personalDetailsList : Object.values(personalDetailsList);

    return personalDetailsListArray
        .map((user) => {
            const accountID = Number(user?.accountID);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            const displayName = getDisplayNameForParticipant(accountID, shouldUseShortForm, shouldFallbackToHidden, shouldAddCurrentUserPostfix) || user?.login || '';
            const avatar = user && 'avatar' in user ? user.avatar : undefined;

            let pronouns = user?.pronouns ?? undefined;
            if (pronouns?.startsWith(CONST.PRONOUNS.PREFIX)) {
                const pronounTranslationKey = pronouns.replace(CONST.PRONOUNS.PREFIX, '');
                pronouns = Localize.translateLocal(`pronouns.${pronounTranslationKey}` as TranslationPaths);
            }

            return {
                displayName,
                avatar,
                login: user?.login ?? '',
                accountID,
                pronouns,
            };
        })
        .sort((first, second) => {
            // First sort by displayName/login
            const displayNameLoginOrder = localeCompare(first.displayName, second.displayName);
            if (displayNameLoginOrder !== 0) {
                return displayNameLoginOrder;
            }

            // Then fallback on accountID as the final sorting criteria.
            return first.accountID - second.accountID;
        });
}

/**
 * Returns the the display names of the given user accountIDs
 */
function getUserDetailTooltipText(accountID: number, fallbackUserDisplayName = ''): string {
    const displayNameForParticipant = getDisplayNameForParticipant(accountID);
    return displayNameForParticipant || fallbackUserDisplayName;
}

/**
 * For a deleted parent report action within a chat report,
 * let us return the appropriate display message
 *
 * @param reportAction - The deleted report action of a chat report for which we need to return message.
 */
function getDeletedParentActionMessageForChatReport(reportAction: OnyxEntry<ReportAction>): string {
    // By default, let us display [Deleted message]
    let deletedMessageText = Localize.translateLocal('parentReportAction.deletedMessage');
    if (ReportActionsUtils.isCreatedTaskReportAction(reportAction)) {
        // For canceled task report, let us display [Deleted task]
        deletedMessageText = Localize.translateLocal('parentReportAction.deletedTask');
    }
    return deletedMessageText;
}

/**
 * Returns the preview message for `REIMBURSEMENT_QUEUED` action
 */
function getReimbursementQueuedActionMessage(reportAction: OnyxEntry<ReportAction>, report: OnyxEntry<Report>, shouldUseShortDisplayName = true): string {
    const submitterDisplayName = getDisplayNameForParticipant(report?.ownerAccountID, shouldUseShortDisplayName) ?? '';
    const originalMessage = reportAction?.originalMessage as IOUMessage | undefined;
    let messageKey: TranslationPaths;
    if (originalMessage?.paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
        messageKey = 'iou.waitingOnEnabledWallet';
    } else {
        messageKey = 'iou.waitingOnBankAccount';
    }

    return Localize.translateLocal(messageKey, {submitterDisplayName});
}

/**
 * Returns the preview message for `REIMBURSEMENT_DEQUEUED` action
 */
function getReimbursementDeQueuedActionMessage(
    reportAction: OnyxEntry<ReportActionBase & OriginalMessageReimbursementDequeued>,
    report: OnyxEntry<Report> | EmptyObject,
    isLHNPreview = false,
): string {
    const originalMessage = reportAction?.originalMessage as ReimbursementDeQueuedMessage | undefined;
    const amount = originalMessage?.amount;
    const currency = originalMessage?.currency;
    const formattedAmount = CurrencyUtils.convertToDisplayString(amount, currency);
    if (originalMessage?.cancellationReason === CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN) {
        const payerOrApproverName = report?.managerID === currentUserAccountID || !isLHNPreview ? '' : getDisplayNameForParticipant(report?.managerID, true);
        return Localize.translateLocal('iou.adminCanceledRequest', {manager: payerOrApproverName, amount: formattedAmount});
    }
    const submitterDisplayName = getDisplayNameForParticipant(report?.ownerAccountID, true) ?? '';
    return Localize.translateLocal('iou.canceledRequest', {submitterDisplayName, amount: formattedAmount});
}

/**
 * Builds an optimistic REIMBURSEMENT_DEQUEUED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticCancelPaymentReportAction(expenseReportID: string, amount: number, currency: string): OptimisticCancelPaymentReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_DEQUEUED,
        actorAccountID: currentUserAccountID,
        message: [
            {
                cancellationReason: CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN,
                expenseReportID,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: '',
                amount,
                currency,
            },
        ],
        originalMessage: {
            cancellationReason: CONST.REPORT.CANCEL_PAYMENT_REASONS.ADMIN,
            expenseReportID,
            amount,
            currency,
        },
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Returns the last visible message for a given report after considering the given optimistic actions
 *
 * @param reportID - the report for which last visible message has to be fetched
 * @param [actionsToMerge] - the optimistic merge actions that needs to be considered while fetching last visible message

 */
function getLastVisibleMessage(reportID: string | undefined, actionsToMerge: ReportActions = {}): LastVisibleMessage {
    const report = getReport(reportID);
    const lastVisibleAction = ReportActionsUtils.getLastVisibleAction(reportID ?? '', actionsToMerge);

    // For Chat Report with deleted parent actions, let us fetch the correct message
    if (ReportActionsUtils.isDeletedParentAction(lastVisibleAction) && !isEmptyObject(report) && isChatReport(report)) {
        const lastMessageText = getDeletedParentActionMessageForChatReport(lastVisibleAction);
        return {
            lastMessageText,
        };
    }

    // Fetch the last visible message for report represented by reportID and based on actions to merge.
    return ReportActionsUtils.getLastVisibleMessage(reportID ?? '', actionsToMerge);
}

/**
 * Checks if a report is an open task report assigned to current user.
 *
 * @param [parentReportAction] - The parent report action of the report (Used to check if the task has been canceled)
 */
function isWaitingForAssigneeToCompleteTask(report: OnyxEntry<Report>, parentReportAction: OnyxEntry<ReportAction> | EmptyObject = {}): boolean {
    return isTaskReport(report) && isReportManager(report) && isOpenTaskReport(report, parentReportAction);
}

function isUnreadWithMention(reportOrOption: OnyxEntry<Report> | OptionData): boolean {
    if (!reportOrOption) {
        return false;
    }
    // lastMentionedTime and lastReadTime are both datetime strings and can be compared directly
    const lastMentionedTime = reportOrOption.lastMentionedTime ?? '';
    const lastReadTime = reportOrOption.lastReadTime ?? '';
    return Boolean('isUnreadWithMention' in reportOrOption && reportOrOption.isUnreadWithMention) || lastReadTime < lastMentionedTime;
}

/**
 * Determines if the option requires action from the current user. This can happen when it:
 *  - is unread and the user was mentioned in one of the unread comments
 *  - is for an outstanding task waiting on the user
 *  - has an outstanding child expense that is waiting for an action from the current user (e.g. pay, approve, add bank account)
 *
 * @param option (report or optionItem)
 * @param parentReportAction (the report action the current report is a thread of)
 */
function requiresAttentionFromCurrentUser(optionOrReport: OnyxEntry<Report> | OptionData, parentReportAction: EmptyObject | OnyxEntry<ReportAction> = {}) {
    if (!optionOrReport) {
        return false;
    }

    if (isJoinRequestInAdminRoom(optionOrReport)) {
        return true;
    }

    if (isArchivedRoom(optionOrReport) || isArchivedRoom(getReport(optionOrReport.parentReportID))) {
        return false;
    }

    if (isUnreadWithMention(optionOrReport)) {
        return true;
    }

    if (isWaitingForAssigneeToCompleteTask(optionOrReport, parentReportAction)) {
        return true;
    }

    // Has a child report that is awaiting action (e.g. approve, pay, add bank account) from current user
    if (optionOrReport.hasOutstandingChildRequest) {
        return true;
    }

    return false;
}

/**
 * Returns number of transactions that are nonReimbursable
 *
 */
function hasNonReimbursableTransactions(iouReportID: string | undefined): boolean {
    const transactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return transactions.filter((transaction) => transaction.reimbursable === false).length > 0;
}

function getMoneyRequestSpendBreakdown(report: OnyxEntry<Report>, allReportsDict: OnyxCollection<Report> = null): SpendBreakdown {
    const allAvailableReports = allReportsDict ?? allReports;
    let moneyRequestReport;
    if (isMoneyRequestReport(report) || isInvoiceReport(report)) {
        moneyRequestReport = report;
    }
    if (allAvailableReports && report?.iouReportID) {
        moneyRequestReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
    }
    if (moneyRequestReport) {
        let nonReimbursableSpend = moneyRequestReport.nonReimbursableTotal ?? 0;
        let totalSpend = moneyRequestReport.total ?? 0;

        if (nonReimbursableSpend + totalSpend !== 0) {
            // There is a possibility that if the Expense report has a negative total.
            // This is because there are instances where you can get a credit back on your card,
            // or you enter a negative expense to “offset” future expenses
            nonReimbursableSpend = isExpenseReport(moneyRequestReport) ? nonReimbursableSpend * -1 : Math.abs(nonReimbursableSpend);
            totalSpend = isExpenseReport(moneyRequestReport) ? totalSpend * -1 : Math.abs(totalSpend);

            const totalDisplaySpend = totalSpend;
            const reimbursableSpend = totalDisplaySpend - nonReimbursableSpend;

            return {
                nonReimbursableSpend,
                reimbursableSpend,
                totalDisplaySpend,
            };
        }
    }
    return {
        nonReimbursableSpend: 0,
        reimbursableSpend: 0,
        totalDisplaySpend: 0,
    };
}

/**
 * Get the title for a policy expense chat which depends on the role of the policy member seeing this report
 */
function getPolicyExpenseChatName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined): string | undefined {
    const ownerAccountID = report?.ownerAccountID;
    const personalDetails = allPersonalDetails?.[ownerAccountID ?? -1];
    const login = personalDetails ? personalDetails.login : null;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const reportOwnerDisplayName = getDisplayNameForParticipant(ownerAccountID) || login || report?.reportName;

    // If the policy expense chat is owned by this user, use the name of the policy as the report name.
    if (report?.isOwnPolicyExpenseChat) {
        return getPolicyName(report, false, policy);
    }

    let policyExpenseChatRole = 'user';
    const policyItem = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    if (policyItem) {
        policyExpenseChatRole = policyItem.role || 'user';
    }

    // If this user is not admin and this policy expense chat has been archived because of account merging, this must be an old workspace chat
    // of the account which was merged into the current user's account. Use the name of the policy as the name of the report.
    if (isArchivedRoom(report)) {
        const lastAction = ReportActionsUtils.getLastVisibleAction(report?.reportID ?? '');
        const archiveReason = lastAction?.actionName === CONST.REPORT.ACTIONS.TYPE.CLOSED ? lastAction?.originalMessage?.reason : CONST.REPORT.ARCHIVE_REASON.DEFAULT;
        if (archiveReason === CONST.REPORT.ARCHIVE_REASON.ACCOUNT_MERGED && policyExpenseChatRole !== CONST.POLICY.ROLE.ADMIN) {
            return getPolicyName(report, false, policy);
        }
    }

    // If user can see this report and they are not its owner, they must be an admin and the report name should be the name of the policy member
    return reportOwnerDisplayName;
}

/**
 * Given a report field, check if the field is for the report title.
 */
function isReportFieldOfTypeTitle(reportField: OnyxEntry<PolicyReportField>): boolean {
    return reportField?.type === 'formula' && reportField?.fieldID === CONST.REPORT_FIELD_TITLE_FIELD_ID;
}

/**
 * Check if report fields are available to use in a report
 */
function reportFieldsEnabled(report: Report) {
    return Permissions.canUseReportFields(allBetas ?? []) && isPaidGroupPolicyExpenseReport(report);
}

/**
 * Given a report field, check if the field can be edited or not.
 * For title fields, its considered disabled if `deletable` prop is `true` (https://github.com/Expensify/App/issues/35043#issuecomment-1911275433)
 * For non title fields, its considered disabled if:
 * 1. The user is not admin of the report
 * 2. Report is settled or it is closed
 */
function isReportFieldDisabled(report: OnyxEntry<Report>, reportField: OnyxEntry<PolicyReportField>, policy: OnyxEntry<Policy>): boolean {
    const isReportSettled = isSettled(report?.reportID);
    const isReportClosed = isClosedReport(report);
    const isTitleField = isReportFieldOfTypeTitle(reportField);
    const isAdmin = isPolicyAdmin(report?.policyID ?? '', {[`${ONYXKEYS.COLLECTION.POLICY}${policy?.id ?? ''}`]: policy});
    return isTitleField ? !reportField?.deletable : !isAdmin && (isReportSettled || isReportClosed);
}

/**
 * Given a set of report fields, return the field of type formula
 */
function getFormulaTypeReportField(reportFields: Record<string, PolicyReportField>) {
    return Object.values(reportFields).find((field) => field?.type === 'formula');
}

/**
 * Given a set of report fields, return the field that refers to title
 */
function getTitleReportField(reportFields: Record<string, PolicyReportField>) {
    return Object.values(reportFields).find((field) => isReportFieldOfTypeTitle(field));
}

/**
 * Get the key for a report field
 */
function getReportFieldKey(reportFieldId: string) {
    // We don't need to add `expensify_` prefix to the title field key, because backend stored title under a unique key `text_title`,
    // and all the other report field keys are stored under `expensify_FIELD_ID`.
    if (reportFieldId === CONST.REPORT_FIELD_TITLE_FIELD_ID) {
        return reportFieldId;
    }

    return `expensify_${reportFieldId}`;
}

/**
 * Get the report fields attached to the policy given policyID
 */
function getReportFieldsByPolicyID(policyID: string): Record<string, PolicyReportField> {
    const policyReportFields = Object.entries(allPolicies ?? {}).find(([key]) => key.replace(ONYXKEYS.COLLECTION.POLICY, '') === policyID);
    const fieldList = policyReportFields?.[1]?.fieldList;

    if (!policyReportFields || !fieldList) {
        return {};
    }

    return fieldList;
}

/**
 * Get the report fields that we should display a MoneyReportView gets opened
 */

function getAvailableReportFields(report: Report, policyReportFields: PolicyReportField[]): PolicyReportField[] {
    // Get the report fields that are attached to a report. These will persist even if a field is deleted from the policy.
    const reportFields = Object.values(report.fieldList ?? {});
    const reportIsSettled = isSettled(report.reportID);

    // If the report is settled, we don't want to show any new field that gets added to the policy.
    if (reportIsSettled) {
        return reportFields;
    }

    // If the report is unsettled, we want to merge the new fields that get added to the policy with the fields that
    // are attached to the report.
    const mergedFieldIds = Array.from(new Set([...policyReportFields.map(({fieldID}) => fieldID), ...reportFields.map(({fieldID}) => fieldID)]));

    const fields = mergedFieldIds.map((id) => {
        const field = report?.fieldList?.[getReportFieldKey(id)];

        if (field) {
            return field;
        }

        const policyReportField = policyReportFields.find(({fieldID}) => fieldID === id);

        if (policyReportField) {
            return policyReportField;
        }

        return null;
    });

    return fields.filter(Boolean) as PolicyReportField[];
}

/**
 * Get the title for an IOU or expense chat which will be showing the payer and the amount
 */
function getMoneyRequestReportName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined = undefined): string {
    const isReportSettled = isSettled(report?.reportID ?? '');
    const reportFields = isReportSettled ? report?.fieldList : getReportFieldsByPolicyID(report?.policyID ?? '');
    const titleReportField = getFormulaTypeReportField(reportFields ?? {});

    if (titleReportField && report?.reportName && reportFieldsEnabled(report)) {
        return report.reportName;
    }

    const moneyRequestTotal = getMoneyRequestSpendBreakdown(report).totalDisplaySpend;
    const formattedAmount = CurrencyUtils.convertToDisplayString(moneyRequestTotal, report?.currency);
    let payerOrApproverName = isExpenseReport(report) ? getPolicyName(report, false, policy) : getDisplayNameForParticipant(report?.managerID) ?? '';
    const payerPaidAmountMessage = Localize.translateLocal('iou.payerPaidAmount', {
        payer: payerOrApproverName,
        amount: formattedAmount,
    });

    if (isReportApproved(report)) {
        return Localize.translateLocal('iou.managerApprovedAmount', {
            manager: payerOrApproverName,
            amount: formattedAmount,
        });
    }

    if (report?.isWaitingOnBankAccount) {
        return `${payerPaidAmountMessage} ${CONST.DOT_SEPARATOR} ${Localize.translateLocal('iou.pending')}`;
    }

    if (!isSettled(report?.reportID) && hasNonReimbursableTransactions(report?.reportID)) {
        payerOrApproverName = getDisplayNameForParticipant(report?.ownerAccountID) ?? '';
        return Localize.translateLocal('iou.payerSpentAmount', {payer: payerOrApproverName, amount: formattedAmount});
    }

    if (isProcessingReport(report) || isOpenExpenseReport(report) || isOpenInvoiceReport(report) || moneyRequestTotal === 0) {
        return Localize.translateLocal('iou.payerOwesAmount', {payer: payerOrApproverName, amount: formattedAmount});
    }

    return payerPaidAmountMessage;
}

/**
 * Gets transaction created, amount, currency, comment, and waypoints (for distance expense)
 * into a flat object. Used for displaying transactions and sending them in API commands
 */

function getTransactionDetails(transaction: OnyxEntry<Transaction>, createdDateFormat: string = CONST.DATE.FNS_FORMAT_STRING): TransactionDetails | undefined {
    if (!transaction) {
        return;
    }
    const report = getReport(transaction?.reportID);
    return {
        created: TransactionUtils.getCreated(transaction, createdDateFormat),
        amount: TransactionUtils.getAmount(transaction, !isEmptyObject(report) && isExpenseReport(report)),
        taxAmount: TransactionUtils.getTaxAmount(transaction, !isEmptyObject(report) && isExpenseReport(report)),
        taxCode: TransactionUtils.getTaxCode(transaction),
        currency: TransactionUtils.getCurrency(transaction),
        comment: TransactionUtils.getDescription(transaction),
        merchant: TransactionUtils.getMerchant(transaction),
        waypoints: TransactionUtils.getWaypoints(transaction),
        category: TransactionUtils.getCategory(transaction),
        billable: TransactionUtils.getBillable(transaction),
        tag: TransactionUtils.getTag(transaction),
        mccGroup: TransactionUtils.getMCCGroup(transaction),
        cardID: TransactionUtils.getCardID(transaction),
        originalAmount: TransactionUtils.getOriginalAmount(transaction),
        originalCurrency: TransactionUtils.getOriginalCurrency(transaction),
    };
}

function getTransactionCommentObject(transaction: OnyxEntry<Transaction>): Comment {
    return {
        ...transaction?.comment,
        waypoints: TransactionUtils.getWaypoints(transaction),
    };
}

/**
 * Can only edit if:
 *
 * - in case of IOU report
 *    - the current user is the requestor and is not settled yet
 * - in case of expense report
 *    - the current user is the requestor and is not settled yet
 *    - the current user is the manager of the report
 *    - or the current user is an admin on the policy the expense report is tied to
 *
 *    This is used in conjunction with canEditRestrictedField to control editing of specific fields like amount, currency, created, receipt, and distance.
 *    On its own, it only controls allowing/disallowing navigating to the editing pages or showing/hiding the 'Edit' icon on report actions
 */
function canEditMoneyRequest(reportAction: OnyxEntry<ReportAction>): boolean {
    const isDeleted = ReportActionsUtils.isDeletedAction(reportAction);

    if (isDeleted) {
        return false;
    }

    // If the report action is not IOU type, return true early
    if (reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.IOU) {
        return true;
    }

    const allowedReportActionType: Array<ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>> = [CONST.IOU.REPORT_ACTION_TYPE.TRACK, CONST.IOU.REPORT_ACTION_TYPE.CREATE];

    if (!allowedReportActionType.includes(reportAction.originalMessage.type)) {
        return false;
    }

    const moneyRequestReportID = reportAction?.originalMessage?.IOUReportID ?? 0;

    if (!moneyRequestReportID) {
        return reportAction.originalMessage.type === CONST.IOU.REPORT_ACTION_TYPE.TRACK;
    }

    const moneyRequestReport = getReport(String(moneyRequestReportID));
    const isRequestor = currentUserAccountID === reportAction?.actorAccountID;

    if (isIOUReport(moneyRequestReport)) {
        return isProcessingReport(moneyRequestReport) && isRequestor;
    }

    const policy = getPolicy(moneyRequestReport?.policyID ?? '');
    const isAdmin = policy.role === CONST.POLICY.ROLE.ADMIN;
    const isManager = currentUserAccountID === moneyRequestReport?.managerID;

    if (isInvoiceReport(moneyRequestReport) && isManager) {
        return false;
    }

    // Admin & managers can always edit coding fields such as tag, category, billable, etc. As long as the report has a state higher than OPEN.
    if ((isAdmin || isManager) && !isOpenExpenseReport(moneyRequestReport)) {
        return true;
    }

    return !isReportApproved(moneyRequestReport) && !isSettled(moneyRequestReport?.reportID) && isRequestor;
}

/**
 * Checks if the current user can edit the provided property of an expense
 *
 */
function canEditFieldOfMoneyRequest(reportAction: OnyxEntry<ReportAction>, fieldToEdit: ValueOf<typeof CONST.EDIT_REQUEST_FIELD>): boolean {
    // A list of fields that cannot be edited by anyone, once an expense has been settled
    const restrictedFields: string[] = [
        CONST.EDIT_REQUEST_FIELD.AMOUNT,
        CONST.EDIT_REQUEST_FIELD.CURRENCY,
        CONST.EDIT_REQUEST_FIELD.MERCHANT,
        CONST.EDIT_REQUEST_FIELD.DATE,
        CONST.EDIT_REQUEST_FIELD.RECEIPT,
        CONST.EDIT_REQUEST_FIELD.DISTANCE,
    ];

    if (!canEditMoneyRequest(reportAction)) {
        return false;
    }

    // If we're editing fields such as category, tag, description, etc. the check above should be enough for handling the permission
    if (!restrictedFields.includes(fieldToEdit)) {
        return true;
    }

    const iouMessage = reportAction?.originalMessage as IOUMessage;
    const moneyRequestReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${iouMessage?.IOUReportID}`] ?? ({} as Report);
    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${iouMessage?.IOUTransactionID}`] ?? ({} as Transaction);

    if (isSettled(String(moneyRequestReport.reportID)) || isReportApproved(String(moneyRequestReport.reportID))) {
        return false;
    }

    if (
        (fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT || fieldToEdit === CONST.EDIT_REQUEST_FIELD.CURRENCY || fieldToEdit === CONST.EDIT_REQUEST_FIELD.DATE) &&
        TransactionUtils.isCardTransaction(transaction)
    ) {
        return false;
    }

    if ((fieldToEdit === CONST.EDIT_REQUEST_FIELD.AMOUNT || fieldToEdit === CONST.EDIT_REQUEST_FIELD.CURRENCY) && TransactionUtils.isDistanceRequest(transaction)) {
        const policy = getPolicy(moneyRequestReport?.reportID ?? '');
        const isAdmin = isExpenseReport(moneyRequestReport) && policy.role === CONST.POLICY.ROLE.ADMIN;
        const isManager = isExpenseReport(moneyRequestReport) && currentUserAccountID === moneyRequestReport?.managerID;

        return isAdmin || isManager;
    }

    if (fieldToEdit === CONST.EDIT_REQUEST_FIELD.RECEIPT) {
        const isRequestor = currentUserAccountID === reportAction?.actorAccountID;
        return !isInvoiceReport(moneyRequestReport) && !TransactionUtils.isReceiptBeingScanned(transaction) && !TransactionUtils.isDistanceRequest(transaction) && isRequestor;
    }

    return true;
}

/**
 * Can only edit if:
 *
 * - It was written by the current user
 * - It's an ADD_COMMENT that is not an attachment
 * - It's an expense where conditions for editability are defined in canEditMoneyRequest method
 * - It's not pending deletion
 */
function canEditReportAction(reportAction: OnyxEntry<ReportAction>): boolean {
    const isCommentOrIOU = reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT || reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU;

    return Boolean(
        reportAction?.actorAccountID === currentUserAccountID &&
            isCommentOrIOU &&
            canEditMoneyRequest(reportAction) && // Returns true for non-IOU actions
            !isReportMessageAttachment(reportAction?.message?.[0]) &&
            (isEmptyObject(reportAction.attachmentInfo) || !reportAction.isOptimisticAction) &&
            !ReportActionsUtils.isDeletedAction(reportAction) &&
            !ReportActionsUtils.isCreatedTaskReportAction(reportAction) &&
            reportAction?.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
    );
}

/**
 * Gets all transactions on an IOU report with a receipt
 */
function getTransactionsWithReceipts(iouReportID: string | undefined): Transaction[] {
    const transactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return transactions.filter((transaction) => TransactionUtils.hasReceipt(transaction));
}

/**
 * For report previews, we display a "Receipt scan in progress" indicator
 * instead of the report total only when we have no report total ready to show. This is the case when
 * all requests are receipts that are being SmartScanned. As soon as we have a non-receipt request,
 * or as soon as one receipt request is done scanning, we have at least one
 * "ready" expense, and we remove this indicator to show the partial report total.
 */
function areAllRequestsBeingSmartScanned(iouReportID: string, reportPreviewAction: OnyxEntry<ReportAction>): boolean {
    const transactionsWithReceipts = getTransactionsWithReceipts(iouReportID);
    // If we have more requests than requests with receipts, we have some manual requests
    if (ReportActionsUtils.getNumberOfMoneyRequests(reportPreviewAction) > transactionsWithReceipts.length) {
        return false;
    }
    return transactionsWithReceipts.every((transaction) => TransactionUtils.isReceiptBeingScanned(transaction));
}

/**
 * Get the transactions related to a report preview with receipts
 * Get the details linked to the IOU reportAction
 *
 * NOTE: This method is only meant to be used inside this action file. Do not export and use it elsewhere. Use withOnyx or Onyx.connect() instead.
 */
function getLinkedTransaction(reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>): Transaction | EmptyObject {
    let transactionID = '';

    if (reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.IOU) {
        transactionID = (reportAction?.originalMessage as IOUMessage)?.IOUTransactionID ?? '';
    }

    return allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? {};
}

/**
 * Check if any of the transactions in the report has required missing fields
 */
function hasMissingSmartscanFields(iouReportID: string): boolean {
    return TransactionUtils.getAllReportTransactions(iouReportID).some(TransactionUtils.hasMissingSmartscanFields);
}

/**
 * Check if iouReportID has required missing fields
 */
function shouldShowRBRForMissingSmartscanFields(iouReportID: string): boolean {
    const reportActions = Object.values(ReportActionsUtils.getAllReportActions(iouReportID));
    return reportActions.some((action) => {
        if (!ReportActionsUtils.isMoneyRequestAction(action)) {
            return false;
        }
        const transaction = getLinkedTransaction(action);
        if (isEmptyObject(transaction)) {
            return false;
        }
        if (!ReportActionsUtils.wasActionTakenByCurrentUser(action)) {
            return false;
        }
        return TransactionUtils.hasMissingSmartscanFields(transaction);
    });
}

/**
 * Given a parent IOU report action get report name for the LHN.
 */
function getTransactionReportName(reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>): string {
    if (ReportActionsUtils.isReversedTransaction(reportAction)) {
        return Localize.translateLocal('parentReportAction.reversedTransaction');
    }

    if (ReportActionsUtils.isDeletedAction(reportAction)) {
        return Localize.translateLocal('parentReportAction.deletedExpense');
    }

    const transaction = getLinkedTransaction(reportAction);

    if (isEmptyObject(transaction)) {
        // Transaction data might be empty on app's first load, if so we fallback to Expense/Track Expense
        return ReportActionsUtils.isTrackExpenseAction(reportAction) ? Localize.translateLocal('iou.trackExpense') : Localize.translateLocal('iou.expense');
    }

    if (TransactionUtils.hasReceipt(transaction) && TransactionUtils.isReceiptBeingScanned(transaction)) {
        return Localize.translateLocal('iou.receiptScanning');
    }

    if (TransactionUtils.hasMissingSmartscanFields(transaction)) {
        return Localize.translateLocal('iou.receiptMissingDetails');
    }

    if (TransactionUtils.isFetchingWaypointsFromServer(transaction) && TransactionUtils.getMerchant(transaction) === Localize.translateLocal('iou.fieldPending')) {
        return Localize.translateLocal('iou.fieldPending');
    }

    const transactionDetails = getTransactionDetails(transaction);

    const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency) ?? '';
    const comment = (!TransactionUtils.isMerchantMissing(transaction) ? transactionDetails?.merchant : transactionDetails?.comment) ?? '';
    if (ReportActionsUtils.isTrackExpenseAction(reportAction)) {
        return Localize.translateLocal('iou.threadTrackReportName', {formattedAmount, comment});
    }
    if (ReportActionsUtils.isSentMoneyReportAction(reportAction)) {
        return Localize.translateLocal('iou.threadPaySomeoneReportName', {formattedAmount, comment});
    }
    return Localize.translateLocal('iou.threadExpenseReportName', {formattedAmount, comment});
}

/**
 * Get expense message for an IOU report
 *
 * @param [iouReportAction] This is always an IOU action. When necessary, report preview actions will be unwrapped and the child iou report action is passed here (the original report preview
 *     action will be passed as `originalReportAction` in this case).
 * @param [originalReportAction] This can be either a report preview action or the IOU action. This will be the original report preview action in cases where `iouReportAction` was unwrapped
 *     from a report preview action. Otherwise, it will be the same as `iouReportAction`.
 */
function getReportPreviewMessage(
    report: OnyxEntry<Report> | EmptyObject,
    iouReportAction: OnyxEntry<ReportAction> | EmptyObject = {},
    shouldConsiderScanningReceiptOrPendingRoute = false,
    isPreviewMessageForParentChatReport = false,
    policy: OnyxEntry<Policy> = null,
    isForListPreview = false,
    originalReportAction: OnyxEntry<ReportAction> | EmptyObject = iouReportAction,
): string {
    const reportActionMessage = iouReportAction?.message?.[0]?.html ?? '';

    if (isEmptyObject(report) || !report?.reportID) {
        // The iouReport is not found locally after SignIn because the OpenApp API won't return iouReports if they're settled
        // As a temporary solution until we know how to solve this the best, we just use the message that returned from BE
        return reportActionMessage;
    }

    if (!isEmptyObject(iouReportAction) && !isIOUReport(report) && iouReportAction && ReportActionsUtils.isSplitBillAction(iouReportAction)) {
        // This covers group chats where the last action is a split expense action
        const linkedTransaction = getLinkedTransaction(iouReportAction);
        if (isEmptyObject(linkedTransaction)) {
            return reportActionMessage;
        }

        if (!isEmptyObject(linkedTransaction)) {
            if (TransactionUtils.isReceiptBeingScanned(linkedTransaction)) {
                return Localize.translateLocal('iou.receiptScanning');
            }

            if (TransactionUtils.hasMissingSmartscanFields(linkedTransaction)) {
                return Localize.translateLocal('iou.receiptMissingDetails');
            }

            const transactionDetails = getTransactionDetails(linkedTransaction);
            const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency);
            return Localize.translateLocal('iou.didSplitAmount', {formattedAmount, comment: transactionDetails?.comment ?? ''});
        }
    }

    if (!isEmptyObject(iouReportAction) && !isIOUReport(report) && iouReportAction && ReportActionsUtils.isTrackExpenseAction(iouReportAction)) {
        // This covers group chats where the last action is a track expense action
        const linkedTransaction = getLinkedTransaction(iouReportAction);
        if (isEmptyObject(linkedTransaction)) {
            return reportActionMessage;
        }

        if (!isEmptyObject(linkedTransaction)) {
            if (TransactionUtils.isReceiptBeingScanned(linkedTransaction)) {
                return Localize.translateLocal('iou.receiptScanning');
            }

            if (TransactionUtils.hasMissingSmartscanFields(linkedTransaction)) {
                return Localize.translateLocal('iou.receiptMissingDetails');
            }

            const transactionDetails = getTransactionDetails(linkedTransaction);
            const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency);
            return Localize.translateLocal('iou.trackedAmount', {formattedAmount, comment: transactionDetails?.comment ?? ''});
        }
    }

    const containsNonReimbursable = hasNonReimbursableTransactions(report.reportID);
    const totalAmount = getMoneyRequestSpendBreakdown(report).totalDisplaySpend;

    const policyName = getPolicyName(report, false, policy);
    const payerName = isExpenseReport(report) ? policyName : getDisplayNameForParticipant(report.managerID, !isPreviewMessageForParentChatReport);

    const formattedAmount = CurrencyUtils.convertToDisplayString(totalAmount, report.currency);

    if (isReportApproved(report) && isPaidGroupPolicy(report)) {
        return Localize.translateLocal('iou.managerApprovedAmount', {
            manager: payerName ?? '',
            amount: formattedAmount,
        });
    }

    let linkedTransaction;
    if (!isEmptyObject(iouReportAction) && shouldConsiderScanningReceiptOrPendingRoute && iouReportAction && ReportActionsUtils.isMoneyRequestAction(iouReportAction)) {
        linkedTransaction = getLinkedTransaction(iouReportAction);
    }

    if (!isEmptyObject(linkedTransaction) && TransactionUtils.hasReceipt(linkedTransaction) && TransactionUtils.isReceiptBeingScanned(linkedTransaction)) {
        return Localize.translateLocal('iou.receiptScanning');
    }

    if (!isEmptyObject(linkedTransaction) && TransactionUtils.isFetchingWaypointsFromServer(linkedTransaction) && !TransactionUtils.getAmount(linkedTransaction)) {
        return Localize.translateLocal('iou.fieldPending');
    }

    const originalMessage = iouReportAction?.originalMessage as IOUMessage | undefined;

    // Show Paid preview message if it's settled or if the amount is paid & stuck at receivers end for only chat reports.
    if (isSettled(report.reportID) || (report.isWaitingOnBankAccount && isPreviewMessageForParentChatReport)) {
        // A settled report preview message can come in three formats "paid ... elsewhere" or "paid ... with Expensify"
        let translatePhraseKey: TranslationPaths = 'iou.paidElsewhereWithAmount';
        if (isPreviewMessageForParentChatReport) {
            translatePhraseKey = 'iou.payerPaidAmount';
        } else if (
            [CONST.IOU.PAYMENT_TYPE.VBBA, CONST.IOU.PAYMENT_TYPE.EXPENSIFY].some((paymentType) => paymentType === originalMessage?.paymentType) ||
            !!reportActionMessage.match(/ (with Expensify|using Expensify)$/) ||
            report.isWaitingOnBankAccount
        ) {
            translatePhraseKey = 'iou.paidWithExpensifyWithAmount';
        }

        let actualPayerName = report.managerID === currentUserAccountID ? '' : getDisplayNameForParticipant(report.managerID, true);
        actualPayerName = actualPayerName && isForListPreview && !isPreviewMessageForParentChatReport ? `${actualPayerName}:` : actualPayerName;
        const payerDisplayName = isPreviewMessageForParentChatReport ? payerName : actualPayerName;

        return Localize.translateLocal(translatePhraseKey, {amount: formattedAmount, payer: payerDisplayName ?? ''});
    }

    if (report.isWaitingOnBankAccount) {
        const submitterDisplayName = getDisplayNameForParticipant(report.ownerAccountID ?? -1, true) ?? '';
        return Localize.translateLocal('iou.waitingOnBankAccount', {submitterDisplayName});
    }

    const lastActorID = iouReportAction?.actorAccountID;
    let amount = originalMessage?.amount;
    let currency = originalMessage?.currency ? originalMessage?.currency : report.currency;

    if (!isEmptyObject(linkedTransaction)) {
        amount = TransactionUtils.getAmount(linkedTransaction, isExpenseReport(report));
        currency = TransactionUtils.getCurrency(linkedTransaction);
    }

    if (isEmptyObject(linkedTransaction) && !isEmptyObject(iouReportAction)) {
        linkedTransaction = getLinkedTransaction(iouReportAction);
    }

    let comment = !isEmptyObject(linkedTransaction) ? TransactionUtils.getDescription(linkedTransaction) : undefined;
    if (!isEmptyObject(originalReportAction) && ReportActionsUtils.isReportPreviewAction(originalReportAction) && ReportActionsUtils.getNumberOfMoneyRequests(originalReportAction) !== 1) {
        comment = undefined;
    }

    // if we have the amount in the originalMessage and lastActorID, we can use that to display the preview message for the latest expense
    if (amount !== undefined && lastActorID && !isPreviewMessageForParentChatReport) {
        const amountToDisplay = CurrencyUtils.convertToDisplayString(Math.abs(amount), currency);

        // We only want to show the actor name in the preview if it's not the current user who took the action
        const requestorName = lastActorID && lastActorID !== currentUserAccountID ? getDisplayNameForParticipant(lastActorID, !isPreviewMessageForParentChatReport) : '';
        return `${requestorName ? `${requestorName}: ` : ''}${Localize.translateLocal('iou.submittedAmount', {formattedAmount: amountToDisplay, comment})}`;
    }

    if (containsNonReimbursable) {
        return Localize.translateLocal('iou.payerSpentAmount', {payer: getDisplayNameForParticipant(report.ownerAccountID) ?? '', amount: formattedAmount});
    }

    return Localize.translateLocal('iou.payerOwesAmount', {payer: payerName ?? '', amount: formattedAmount, comment});
}

/**
 * Given the updates user made to the expense, compose the originalMessage
 * object of the modified expense action.
 *
 * At the moment, we only allow changing one transaction field at a time.
 */
function getModifiedExpenseOriginalMessage(
    oldTransaction: OnyxEntry<Transaction>,
    transactionChanges: TransactionChanges,
    isFromExpenseReport: boolean,
    policy: OnyxEntry<Policy>,
): ExpenseOriginalMessage {
    const originalMessage: ExpenseOriginalMessage = {};
    // Remark: Comment field is the only one which has new/old prefixes for the keys (newComment/ oldComment),
    // all others have old/- pattern such as oldCreated/created
    if ('comment' in transactionChanges) {
        originalMessage.oldComment = TransactionUtils.getDescription(oldTransaction);
        originalMessage.newComment = transactionChanges?.comment;
    }
    if ('created' in transactionChanges) {
        originalMessage.oldCreated = TransactionUtils.getCreated(oldTransaction);
        originalMessage.created = transactionChanges?.created;
    }
    if ('merchant' in transactionChanges) {
        originalMessage.oldMerchant = TransactionUtils.getMerchant(oldTransaction);
        originalMessage.merchant = transactionChanges?.merchant;
    }

    // The amount is always a combination of the currency and the number value so when one changes we need to store both
    // to match how we handle the modified expense action in oldDot
    const didAmountOrCurrencyChange = 'amount' in transactionChanges || 'currency' in transactionChanges;
    if (didAmountOrCurrencyChange) {
        originalMessage.oldAmount = TransactionUtils.getAmount(oldTransaction, isFromExpenseReport);
        originalMessage.amount = transactionChanges?.amount ?? transactionChanges.oldAmount;
        originalMessage.oldCurrency = TransactionUtils.getCurrency(oldTransaction);
        originalMessage.currency = transactionChanges?.currency ?? transactionChanges.oldCurrency;
    }

    if ('category' in transactionChanges) {
        originalMessage.oldCategory = TransactionUtils.getCategory(oldTransaction);
        originalMessage.category = transactionChanges?.category;
    }

    if ('tag' in transactionChanges) {
        originalMessage.oldTag = TransactionUtils.getTag(oldTransaction);
        originalMessage.tag = transactionChanges?.tag;
    }

    // We only want to display a tax rate update system message when tax rate is updated by user.
    // Tax rate can change as a result of currency update. In such cases, we want to skip displaying a system message, as discussed.
    const didTaxCodeChange = 'taxCode' in transactionChanges;
    if (didTaxCodeChange && !didAmountOrCurrencyChange) {
        originalMessage.oldTaxRate = policy?.taxRates?.taxes[TransactionUtils.getTaxCode(oldTransaction)]?.value;
        originalMessage.taxRate = transactionChanges?.taxCode && policy?.taxRates?.taxes[transactionChanges?.taxCode].value;
    }

    // We only want to display a tax amount update system message when tax amount is updated by user.
    // Tax amount can change as a result of amount, currency or tax rate update. In such cases, we want to skip displaying a system message, as discussed.
    if ('taxAmount' in transactionChanges && !(didAmountOrCurrencyChange || didTaxCodeChange)) {
        originalMessage.oldTaxAmount = TransactionUtils.getTaxAmount(oldTransaction, isFromExpenseReport);
        originalMessage.taxAmount = transactionChanges?.taxAmount;
        originalMessage.currency = TransactionUtils.getCurrency(oldTransaction);
    }

    if ('billable' in transactionChanges) {
        const oldBillable = TransactionUtils.getBillable(oldTransaction);
        originalMessage.oldBillable = oldBillable ? Localize.translateLocal('common.billable').toLowerCase() : Localize.translateLocal('common.nonBillable').toLowerCase();
        originalMessage.billable = transactionChanges?.billable ? Localize.translateLocal('common.billable').toLowerCase() : Localize.translateLocal('common.nonBillable').toLowerCase();
    }

    return originalMessage;
}

/**
 * Check if original message is an object and can be used as a ChangeLog type
 * @param originalMessage
 */
function isChangeLogObject(originalMessage?: ChangeLog): ChangeLog | undefined {
    if (originalMessage && typeof originalMessage === 'object') {
        return originalMessage;
    }
    return undefined;
}

/**
 * Build invited usernames for admin chat threads
 * @param parentReportAction
 * @param parentReportActionMessage
 */
function getAdminRoomInvitedParticipants(parentReportAction: ReportAction | Record<string, never>, parentReportActionMessage: string) {
    if (!parentReportAction?.originalMessage) {
        return parentReportActionMessage || Localize.translateLocal('parentReportAction.deletedMessage');
    }
    const originalMessage = isChangeLogObject(parentReportAction.originalMessage);
    const participantAccountIDs = originalMessage?.targetAccountIDs ?? [];

    const participants = participantAccountIDs.map((id) => {
        const name = getDisplayNameForParticipant(id);
        if (name && name?.length > 0) {
            return name;
        }
        return Localize.translateLocal('common.hidden');
    });
    const users = participants.length > 1 ? participants.join(` ${Localize.translateLocal('common.and')} `) : participants[0];
    if (!users) {
        return parentReportActionMessage;
    }
    const actionType = parentReportAction.actionName;
    const isInviteAction = actionType === CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.INVITE_TO_ROOM || actionType === CONST.REPORT.ACTIONS.TYPE.POLICY_CHANGE_LOG.INVITE_TO_ROOM;

    const verbKey = isInviteAction ? 'workspace.invite.invited' : 'workspace.invite.removed';
    const prepositionKey = isInviteAction ? 'workspace.invite.to' : 'workspace.invite.from';

    const verb = Localize.translateLocal(verbKey);
    const preposition = Localize.translateLocal(prepositionKey);

    const roomName = originalMessage?.roomName ?? '';

    return roomName ? `${verb} ${users} ${preposition} ${roomName}` : `${verb} ${users}`;
}

/**
 * Get the invoice payer name based on its type:
 * - Individual - a receiver display name.
 * - Policy - a receiver policy name.
 */
function getInvoicePayerName(report: OnyxEntry<Report>): string {
    const invoiceReceiver = report?.invoiceReceiver;
    const isIndividual = invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL;

    if (isIndividual) {
        return PersonalDetailsUtils.getDisplayNameOrDefault(allPersonalDetails?.[invoiceReceiver.accountID]);
    }

    return getPolicyName(report, false, allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${invoiceReceiver?.policyID}`]);
}

/**
 * Parse html of reportAction into text
 */
function parseReportActionHtmlToText(reportAction: OnyxEntry<ReportAction>, reportID: string, childReportID?: string): string {
    if (!reportAction) {
        return '';
    }
    const key = `${reportID}_${reportAction.reportActionID}_${reportAction.lastModified}`;
    const cachedText = parsedReportActionMessageCache[key];
    if (cachedText !== undefined) {
        return cachedText;
    }

    const {html, text} = reportAction?.message?.[0] ?? {};

    if (!html) {
        return text ?? '';
    }

    const mentionReportRegex = /<mention-report reportID="(\d+)" *\/>/gi;
    const matches = html.matchAll(mentionReportRegex);

    const reportIDToName: Record<string, string> = {};
    for (const match of matches) {
        if (match[1] !== childReportID) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            reportIDToName[match[1]] = getReportName(getReport(match[1])) ?? '';
        }
    }

    const mentionUserRegex = /<mention-user accountID="(\d+)" *\/>/gi;
    const accountIDToName: Record<string, string> = {};
    const accountIDs = Array.from(html.matchAll(mentionUserRegex), (mention) => Number(mention[1]));
    const logins = PersonalDetailsUtils.getLoginsByAccountIDs(accountIDs);
    accountIDs.forEach((id, index) => (accountIDToName[id] = logins[index]));

    const parser = new ExpensiMark();
    const textMessage = Str.removeSMSDomain(parser.htmlToText(html, {reportIDToName, accountIDToName}));
    parsedReportActionMessageCache[key] = textMessage;

    return textMessage;
}

/**
 * Get the report action message for a report action.
 */
function getReportActionMessage(reportAction: ReportAction | EmptyObject, reportID?: string, childReportID?: string) {
    if (isEmptyObject(reportAction)) {
        return '';
    }
    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.HOLD) {
        return Localize.translateLocal('iou.heldExpense');
    }
    if (reportAction.actionName === CONST.REPORT.ACTIONS.TYPE.UNHOLD) {
        return Localize.translateLocal('iou.unheldExpense');
    }
    if (ReportActionsUtils.isApprovedOrSubmittedReportAction(reportAction)) {
        return ReportActionsUtils.getReportActionMessageText(reportAction);
    }
    if (ReportActionsUtils.isReimbursementQueuedAction(reportAction)) {
        return getReimbursementQueuedActionMessage(reportAction, getReport(reportID), false);
    }

    return parseReportActionHtmlToText(reportAction, reportID ?? '', childReportID);
}

/**
 * Get the title for an invoice room.
 */
function getInvoicesChatName(report: OnyxEntry<Report>): string {
    const invoiceReceiver = report?.invoiceReceiver;
    const isIndividual = invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL;
    const invoiceReceiverAccountID = isIndividual ? invoiceReceiver.accountID : -1;
    const invoiceReceiverPolicyID = isIndividual ? '' : invoiceReceiver?.policyID ?? '';
    const isCurrentUserReceiver =
        (isIndividual && invoiceReceiverAccountID === currentUserAccountID) || (!isIndividual && PolicyUtils.isPolicyEmployee(invoiceReceiverPolicyID, allPolicies));

    if (isCurrentUserReceiver) {
        return getPolicyName(report);
    }

    if (isIndividual) {
        return PersonalDetailsUtils.getDisplayNameOrDefault(allPersonalDetails?.[invoiceReceiverAccountID]);
    }

    // TODO: Check this flow in a scope of the Invoice V0.3
    return getPolicyName(report, false, allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${invoiceReceiverPolicyID}`]);
}

/**
 * Get the title for a report.
 */
function getReportName(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> = null): string {
    let formattedName: string | undefined;
    const parentReportAction = ReportActionsUtils.getParentReportAction(report);
    if (isChatThread(report)) {
        if (!isEmptyObject(parentReportAction) && ReportActionsUtils.isTransactionThread(parentReportAction)) {
            formattedName = getTransactionReportName(parentReportAction);
            if (isArchivedRoom(report)) {
                formattedName += ` (${Localize.translateLocal('common.archived')})`;
            }
            return formatReportLastMessageText(formattedName);
        }

        if (parentReportAction?.message?.[0]?.isDeletedParentAction) {
            return Localize.translateLocal('parentReportAction.deletedMessage');
        }

        const isAttachment = ReportActionsUtils.isReportActionAttachment(!isEmptyObject(parentReportAction) ? parentReportAction : null);
        const parentReportActionMessage = getReportActionMessage(parentReportAction, report?.parentReportID, report?.reportID ?? '').replace(/(\r\n|\n|\r)/gm, ' ');
        if (isAttachment && parentReportActionMessage) {
            return `[${Localize.translateLocal('common.attachment')}]`;
        }
        if (
            parentReportAction?.message?.[0]?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_HIDE ||
            parentReportAction?.message?.[0]?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_HIDDEN ||
            parentReportAction?.message?.[0]?.moderationDecision?.decision === CONST.MODERATION.MODERATOR_DECISION_PENDING_REMOVE
        ) {
            return Localize.translateLocal('parentReportAction.hiddenMessage');
        }
        if (isAdminRoom(report) || isUserCreatedPolicyRoom(report)) {
            return getAdminRoomInvitedParticipants(parentReportAction, parentReportActionMessage);
        }
        if (parentReportActionMessage && isArchivedRoom(report)) {
            return `${parentReportActionMessage} (${Localize.translateLocal('common.archived')})`;
        }
        if (ReportActionsUtils.isModifiedExpenseAction(parentReportAction)) {
            return ModifiedExpenseMessage.getForReportAction(report?.reportID, parentReportAction);
        }

        if (isTripRoom(report)) {
            return report?.reportName ?? '';
        }

        return parentReportActionMessage;
    }

    if (isClosedExpenseReportWithNoExpenses(report)) {
        return Localize.translateLocal('parentReportAction.deletedReport');
    }

    if (isTaskReport(report) && isCanceledTaskReport(report, parentReportAction)) {
        return Localize.translateLocal('parentReportAction.deletedTask');
    }

    if (isGroupChat(report)) {
        return getGroupChatName(undefined, true, report?.reportID) ?? '';
    }

    if (isChatRoom(report) || isTaskReport(report)) {
        formattedName = report?.reportName;
    }

    if (isPolicyExpenseChat(report)) {
        formattedName = getPolicyExpenseChatName(report, policy);
    }

    if (isMoneyRequestReport(report) || isInvoiceReport(report)) {
        formattedName = getMoneyRequestReportName(report, policy);
    }

    if (isInvoiceRoom(report)) {
        formattedName = getInvoicesChatName(report);
    }

    if (isArchivedRoom(report)) {
        formattedName += ` (${Localize.translateLocal('common.archived')})`;
    }

    if (isSelfDM(report)) {
        formattedName = getDisplayNameForParticipant(currentUserAccountID, undefined, undefined, true);
    }

    if (isInvoiceRoom(report)) {
        formattedName = getInvoicesChatName(report);
    }

    if (formattedName) {
        return formatReportLastMessageText(formattedName);
    }

    // Not a room or PolicyExpenseChat, generate title from first 5 other participants
    const participantsWithoutCurrentUser = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID)
        .slice(0, 5);
    const isMultipleParticipantReport = participantsWithoutCurrentUser.length > 1;
    return participantsWithoutCurrentUser.map((accountID) => getDisplayNameForParticipant(accountID, isMultipleParticipantReport)).join(', ');
}

/**
 * Get the payee name given a report.
 */
function getPayeeName(report: OnyxEntry<Report>): string | undefined {
    if (isEmptyObject(report)) {
        return undefined;
    }

    const participantsWithoutCurrentUser = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID);

    if (participantsWithoutCurrentUser.length === 0) {
        return undefined;
    }
    return getDisplayNameForParticipant(participantsWithoutCurrentUser[0], true);
}

/**
 * Get either the policyName or domainName the chat is tied to
 */
function getChatRoomSubtitle(report: OnyxEntry<Report>): string | undefined {
    if (isChatThread(report)) {
        return '';
    }
    if (isSelfDM(report)) {
        return Localize.translateLocal('reportActionsView.yourSpace');
    }
    if (isInvoiceRoom(report)) {
        return Localize.translateLocal('workspace.common.invoices');
    }
    if (!isDefaultRoom(report) && !isUserCreatedPolicyRoom(report) && !isPolicyExpenseChat(report)) {
        return '';
    }
    if (getChatType(report) === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL) {
        // The domainAll rooms are just #domainName, so we ignore the prefix '#' to get the domainName
        return report?.reportName?.substring(1) ?? '';
    }
    if ((isPolicyExpenseChat(report) && !!report?.isOwnPolicyExpenseChat) || isExpenseReport(report)) {
        return Localize.translateLocal('workspace.common.workspace');
    }
    if (isArchivedRoom(report)) {
        return report?.oldPolicyName ?? '';
    }
    return getPolicyName(report);
}

/**
 * Get pending members for reports
 */
function getPendingChatMembers(accountIDs: number[], previousPendingChatMembers: PendingChatMember[], pendingAction: PendingAction): PendingChatMember[] {
    const pendingChatMembers = accountIDs.map((accountID) => ({accountID: accountID.toString(), pendingAction}));
    return [...previousPendingChatMembers, ...pendingChatMembers];
}

/**
 * Gets the parent navigation subtitle for the report
 */
function getParentNavigationSubtitle(report: OnyxEntry<Report>): ParentNavigationSummaryParams {
    const parentReport = getParentReport(report);
    if (isEmptyObject(parentReport)) {
        return {};
    }

    if (isInvoiceReport(report) || isInvoiceRoom(parentReport)) {
        let reportName = `${getPolicyName(parentReport)} & ${getInvoicePayerName(parentReport)}`;

        if (isArchivedRoom(parentReport)) {
            reportName += ` (${Localize.translateLocal('common.archived')})`;
        }

        return {
            reportName,
        };
    }

    return {
        reportName: getReportName(parentReport),
        workspaceName: getPolicyName(parentReport, true),
    };
}

/**
 * Navigate to the details page of a given report
 */
function navigateToDetailsPage(report: OnyxEntry<Report>) {
    const isSelfDMReport = isSelfDM(report);
    const isOneOnOneChatReport = isOneOnOneChat(report);

    // For 1:1 chat, we don't want to include currentUser as participants in order to not mark 1:1 chats as having multiple participants
    const participantAccountID = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID || !isOneOnOneChatReport);

    if (isSelfDMReport || isOneOnOneChatReport) {
        Navigation.navigate(ROUTES.PROFILE.getRoute(participantAccountID[0]));
        return;
    }

    if (report?.reportID) {
        Navigation.navigate(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report?.reportID));
    }
}

/**
 * Go back to the details page of a given report
 */
function goBackToDetailsPage(report: OnyxEntry<Report>) {
    const isOneOnOneChatReport = isOneOnOneChat(report);

    // For 1:1 chat, we don't want to include currentUser as participants in order to not mark 1:1 chats as having multiple participants
    const participantAccountID = Object.keys(report?.participants ?? {})
        .map(Number)
        .filter((accountID) => accountID !== currentUserAccountID || !isOneOnOneChatReport);

    if (isOneOnOneChatReport) {
        Navigation.navigate(ROUTES.PROFILE.getRoute(participantAccountID[0]));
        return;
    }

    Navigation.goBack(ROUTES.REPORT_SETTINGS.getRoute(report?.reportID ?? ''));
}

/**
 * Go back to the previous page from the edit private page of a given report
 */
function goBackFromPrivateNotes(report: OnyxEntry<Report>, session: OnyxEntry<Session>) {
    if (isEmpty(report) || isEmpty(session) || !session.accountID) {
        return;
    }
    const currentUserPrivateNote = report.privateNotes?.[session.accountID]?.note ?? '';
    if (isEmpty(currentUserPrivateNote)) {
        const participantAccountIDs = Object.keys(report?.participants ?? {})
            .map(Number)
            .filter((accountID) => accountID !== currentUserAccountID || !isOneOnOneChat(report));

        if (isOneOnOneChat(report)) {
            Navigation.goBack(ROUTES.PROFILE.getRoute(participantAccountIDs[0]));
            return;
        }

        if (report?.reportID) {
            Navigation.goBack(ROUTES.REPORT_WITH_ID_DETAILS.getRoute(report?.reportID));
            return;
        }
    }
    Navigation.goBack(ROUTES.PRIVATE_NOTES_LIST.getRoute(report.reportID));
}

/**
 * Generate a random reportID up to 53 bits aka 9,007,199,254,740,991 (Number.MAX_SAFE_INTEGER).
 * There were approximately 98,000,000 reports with sequential IDs generated before we started using this approach, those make up roughly one billionth of the space for these numbers,
 * so we live with the 1 in a billion chance of a collision with an older ID until we can switch to 64-bit IDs.
 *
 * In a test of 500M reports (28 years of reports at our current max rate) we got 20-40 collisions meaning that
 * this is more than random enough for our needs.
 */
function generateReportID(): string {
    return (Math.floor(Math.random() * 2 ** 21) * 2 ** 32 + Math.floor(Math.random() * 2 ** 32)).toString();
}

function hasReportNameError(report: OnyxEntry<Report>): boolean {
    return !isEmptyObject(report?.errorFields?.reportName);
}

/**
 * Adds a domain to a short mention, converting it into a full mention with email or SMS domain.
 * @param mention The user mention to be converted.
 * @returns The converted mention as a full mention string or undefined if conversion is not applicable.
 */
function addDomainToShortMention(mention: string): string | undefined {
    if (!Str.isValidEmail(mention) && currentUserPrivateDomain) {
        const mentionWithEmailDomain = `${mention}@${currentUserPrivateDomain}`;
        if (allPersonalDetailLogins.includes(mentionWithEmailDomain)) {
            return mentionWithEmailDomain;
        }
    }
    if (Str.isValidE164Phone(mention)) {
        const mentionWithSmsDomain = PhoneNumber.addSMSDomainIfPhoneNumber(mention);
        if (allPersonalDetailLogins.includes(mentionWithSmsDomain)) {
            return mentionWithSmsDomain;
        }
    }
    return undefined;
}

/**
 * For comments shorter than or equal to 10k chars, convert the comment from MD into HTML because that's how it is stored in the database
 * For longer comments, skip parsing, but still escape the text, and display plaintext for performance reasons. It takes over 40s to parse a 100k long string!!
 */
function getParsedComment(text: string, parsingDetails?: ParsingDetails): string {
    let isGroupPolicyReport = false;
    if (parsingDetails?.reportID) {
        const currentReport = getReport(parsingDetails?.reportID);
        isGroupPolicyReport = isReportInGroupPolicy(currentReport);
    }

    const parser = new ExpensiMark();
    const textWithMention = text.replace(CONST.REGEX.SHORT_MENTION, (match) => {
        if (!Str.isValidMention(match)) {
            return match;
        }
        const mention = match.substring(1);
        const mentionWithDomain = addDomainToShortMention(mention);
        return mentionWithDomain ? `@${mentionWithDomain}` : match;
    });

    return text.length <= CONST.MAX_MARKUP_LENGTH
        ? parser.replace(textWithMention, {shouldEscapeText: parsingDetails?.shouldEscapeText, disabledRules: isGroupPolicyReport ? [] : ['reportMentions']})
        : lodashEscape(text);
}

function getReportDescriptionText(report: Report): string {
    if (!report.description) {
        return '';
    }

    const parser = new ExpensiMark();
    return parser.htmlToText(report.description);
}

function getPolicyDescriptionText(policy: OnyxEntry<Policy>): string {
    if (!policy?.description) {
        return '';
    }

    const parser = new ExpensiMark();
    return parser.htmlToText(policy.description);
}

function buildOptimisticAddCommentReportAction(
    text?: string,
    file?: FileObject,
    actorAccountID?: number,
    createdOffset = 0,
    shouldEscapeText?: boolean,
    reportID?: string,
): OptimisticReportAction {
    const parser = new ExpensiMark();
    const commentText = getParsedComment(text ?? '', {shouldEscapeText, reportID});
    const isAttachmentOnly = file && !text;
    const isTextOnly = text && !file;

    let htmlForNewComment;
    let textForNewComment;
    if (isAttachmentOnly) {
        htmlForNewComment = CONST.ATTACHMENT_UPLOADING_MESSAGE_HTML;
        textForNewComment = CONST.ATTACHMENT_UPLOADING_MESSAGE_HTML;
    } else if (isTextOnly) {
        htmlForNewComment = commentText;
        textForNewComment = parser.htmlToText(htmlForNewComment);
    } else {
        htmlForNewComment = `${commentText}\n${CONST.ATTACHMENT_UPLOADING_MESSAGE_HTML}`;
        textForNewComment = `${parser.htmlToText(commentText)}\n${CONST.ATTACHMENT_UPLOADING_MESSAGE_HTML}`;
    }

    const isAttachment = !text && file !== undefined;
    const attachmentInfo = file ?? {};
    const accountID = actorAccountID ?? currentUserAccountID;

    // Remove HTML from text when applying optimistic offline comment
    return {
        commentText,
        reportAction: {
            reportActionID: NumberUtils.rand64(),
            actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
            actorAccountID: accountID,
            person: [
                {
                    style: 'strong',
                    text: allPersonalDetails?.[accountID ?? -1]?.displayName ?? currentUserEmail,
                    type: 'TEXT',
                },
            ],
            automatic: false,
            avatar: allPersonalDetails?.[accountID ?? -1]?.avatar,
            created: DateUtils.getDBTimeWithSkew(Date.now() + createdOffset),
            message: [
                {
                    translationKey: isAttachmentOnly ? CONST.TRANSLATION_KEYS.ATTACHMENT : '',
                    type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                    html: htmlForNewComment,
                    text: textForNewComment,
                },
            ],
            isFirstItem: false,
            isAttachment,
            attachmentInfo,
            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            shouldShow: true,
            isOptimisticAction: true,
        },
    };
}

/**
 * update optimistic parent reportAction when a comment is added or remove in the child report
 * @param parentReportAction - Parent report action of the child report
 * @param lastVisibleActionCreated - Last visible action created of the child report
 * @param type - The type of action in the child report
 */

function updateOptimisticParentReportAction(parentReportAction: OnyxEntry<ReportAction>, lastVisibleActionCreated: string, type: string): UpdateOptimisticParentReportAction {
    let childVisibleActionCount = parentReportAction?.childVisibleActionCount ?? 0;
    let childCommenterCount = parentReportAction?.childCommenterCount ?? 0;
    let childOldestFourAccountIDs = parentReportAction?.childOldestFourAccountIDs;

    if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        childVisibleActionCount += 1;
        const oldestFourAccountIDs = childOldestFourAccountIDs ? childOldestFourAccountIDs.split(',') : [];
        if (oldestFourAccountIDs.length < 4) {
            const index = oldestFourAccountIDs.findIndex((accountID) => accountID === currentUserAccountID?.toString());
            if (index === -1) {
                childCommenterCount += 1;
                oldestFourAccountIDs.push(currentUserAccountID?.toString() ?? '');
            }
        }
        childOldestFourAccountIDs = oldestFourAccountIDs.join(',');
    } else if (type === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        if (childVisibleActionCount > 0) {
            childVisibleActionCount -= 1;
        }

        if (childVisibleActionCount === 0) {
            childCommenterCount = 0;
            childOldestFourAccountIDs = '';
        }
    }

    return {
        childVisibleActionCount,
        childCommenterCount,
        childLastVisibleActionCreated: lastVisibleActionCreated,
        childOldestFourAccountIDs,
    };
}

/**
 * Builds an optimistic reportAction for the parent report when a task is created
 * @param taskReportID - Report ID of the task
 * @param taskTitle - Title of the task
 * @param taskAssigneeAccountID - AccountID of the person assigned to the task
 * @param text - Text of the comment
 * @param parentReportID - Report ID of the parent report
 * @param createdOffset - The offset for task's created time that created via a loop
 */
function buildOptimisticTaskCommentReportAction(
    taskReportID: string,
    taskTitle: string,
    taskAssigneeAccountID: number,
    text: string,
    parentReportID: string,
    actorAccountID?: number,
    createdOffset = 0,
): OptimisticReportAction {
    const reportAction = buildOptimisticAddCommentReportAction(text, undefined, undefined, createdOffset, undefined, taskReportID);
    if (reportAction.reportAction.message?.[0]) {
        reportAction.reportAction.message[0].taskReportID = taskReportID;
    }

    // These parameters are not saved on the reportAction, but are used to display the task in the UI
    // Added when we fetch the reportActions on a report
    reportAction.reportAction.originalMessage = {
        html: reportAction.reportAction.message?.[0]?.html,
        taskReportID: reportAction.reportAction.message?.[0]?.taskReportID,
    };
    reportAction.reportAction.childReportID = taskReportID;
    reportAction.reportAction.parentReportID = parentReportID;
    reportAction.reportAction.childType = CONST.REPORT.TYPE.TASK;
    reportAction.reportAction.childReportName = taskTitle;
    reportAction.reportAction.childManagerAccountID = taskAssigneeAccountID;
    reportAction.reportAction.childStatusNum = CONST.REPORT.STATUS_NUM.OPEN;
    reportAction.reportAction.childStateNum = CONST.REPORT.STATE_NUM.OPEN;

    if (actorAccountID) {
        reportAction.reportAction.actorAccountID = actorAccountID;
    }

    return reportAction;
}

/**
 * Builds an optimistic IOU report with a randomly generated reportID
 *
 * @param payeeAccountID - AccountID of the person generating the IOU.
 * @param payerAccountID - AccountID of the other person participating in the IOU.
 * @param total - IOU amount in the smallest unit of the currency.
 * @param chatReportID - Report ID of the chat where the IOU is.
 * @param currency - IOU currency.
 * @param isSendingMoney - If we pay someone the IOU should be created as settled
 */

function buildOptimisticIOUReport(payeeAccountID: number, payerAccountID: number, total: number, chatReportID: string, currency: string, isSendingMoney = false): OptimisticIOUReport {
    const formattedTotal = CurrencyUtils.convertToDisplayString(total, currency);
    const personalDetails = getPersonalDetailsForAccountID(payerAccountID);
    const payerEmail = 'login' in personalDetails ? personalDetails.login : '';

    const participants: Participants = {
        [payeeAccountID]: {hidden: true},
        [payerAccountID]: {hidden: true},
    };

    return {
        type: CONST.REPORT.TYPE.IOU,
        cachedTotal: formattedTotal,
        chatReportID,
        currency,
        managerID: payerAccountID,
        ownerAccountID: payeeAccountID,
        participants,
        reportID: generateReportID(),
        stateNum: isSendingMoney ? CONST.REPORT.STATE_NUM.APPROVED : CONST.REPORT.STATE_NUM.SUBMITTED,
        statusNum: isSendingMoney ? CONST.REPORT.STATUS_NUM.REIMBURSED : CONST.REPORT.STATE_NUM.SUBMITTED,
        total,

        // We don't translate reportName because the server response is always in English
        reportName: `${payerEmail} owes ${formattedTotal}`,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
    };
}

function getHumanReadableStatus(statusNum: number): string {
    const status = Object.keys(CONST.REPORT.STATUS_NUM).find((key) => CONST.REPORT.STATUS_NUM[key as keyof typeof CONST.REPORT.STATUS_NUM] === statusNum);
    return status ? `${status.charAt(0)}${status.slice(1).toLowerCase()}` : '';
}

/**
 * Populates the report field formula with the values from the report and policy.
 * Currently, this only supports optimistic expense reports.
 * Each formula field is either replaced with a value, or removed.
 * If after all replacements the formula is empty, the original formula is returned.
 * See {@link https://help.expensify.com/articles/expensify-classic/insights-and-custom-reporting/Custom-Templates}
 */
function populateOptimisticReportFormula(formula: string, report: OptimisticExpenseReport, policy: Policy | EmptyObject): string {
    const createdDate = report.lastVisibleActionCreated ? new Date(report.lastVisibleActionCreated) : undefined;
    const result = formula
        // We don't translate because the server response is always in English
        .replaceAll('{report:type}', 'Expense Report')
        .replaceAll('{report:startdate}', createdDate ? format(createdDate, CONST.DATE.FNS_FORMAT_STRING) : '')
        .replaceAll('{report:total}', report.total !== undefined ? CurrencyUtils.convertToDisplayString(Math.abs(report.total), report.currency).toString() : '')
        .replaceAll('{report:currency}', report.currency ?? '')
        .replaceAll('{report:policyname}', policy.name ?? '')
        .replaceAll('{report:created}', createdDate ? format(createdDate, CONST.DATE.FNS_DATE_TIME_FORMAT_STRING) : '')
        .replaceAll('{report:created:yyyy-MM-dd}', createdDate ? format(createdDate, CONST.DATE.FNS_FORMAT_STRING) : '')
        .replaceAll('{report:status}', report.statusNum !== undefined ? getHumanReadableStatus(report.statusNum) : '')
        .replaceAll('{user:email}', currentUserEmail ?? '')
        .replaceAll('{user:email|frontPart}', currentUserEmail ? currentUserEmail.split('@')[0] : '')
        .replaceAll(/\{report:(.+)}/g, '');

    return result.trim().length ? result : formula;
}

/** Builds an optimistic invoice report with a randomly generated reportID */
function buildOptimisticInvoiceReport(chatReportID: string, policyID: string, receiverAccountID: number, receiverName: string, total: number, currency: string): OptimisticExpenseReport {
    const formattedTotal = CurrencyUtils.convertToDisplayString(total, currency);

    return {
        reportID: generateReportID(),
        chatReportID,
        policyID,
        type: CONST.REPORT.TYPE.INVOICE,
        ownerAccountID: currentUserAccountID,
        managerID: receiverAccountID,
        currency,
        // We don’t translate reportName because the server response is always in English
        reportName: `${receiverName} owes ${formattedTotal}`,
        stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        total,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
    };
}

/**
 * Builds an optimistic Expense report with a randomly generated reportID
 *
 * @param chatReportID - Report ID of the PolicyExpenseChat where the Expense Report is
 * @param policyID - The policy ID of the PolicyExpenseChat
 * @param payeeAccountID - AccountID of the employee (payee)
 * @param total - Amount in cents
 * @param currency
 * @param reimbursable – Whether the expense is reimbursable
 */
function buildOptimisticExpenseReport(chatReportID: string, policyID: string, payeeAccountID: number, total: number, currency: string, reimbursable = true): OptimisticExpenseReport {
    // The amount for Expense reports are stored as negative value in the database
    const storedTotal = total * -1;
    const policyName = getPolicyName(allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${chatReportID}`]);
    const formattedTotal = CurrencyUtils.convertToDisplayString(storedTotal, currency);
    const policy = getPolicy(policyID);

    const isInstantSubmitEnabled = PolicyUtils.isInstantSubmitEnabled(policy);

    const stateNum = isInstantSubmitEnabled ? CONST.REPORT.STATE_NUM.SUBMITTED : CONST.REPORT.STATE_NUM.OPEN;
    const statusNum = isInstantSubmitEnabled ? CONST.REPORT.STATUS_NUM.SUBMITTED : CONST.REPORT.STATUS_NUM.OPEN;

    const expenseReport: OptimisticExpenseReport = {
        reportID: generateReportID(),
        chatReportID,
        policyID,
        type: CONST.REPORT.TYPE.EXPENSE,
        ownerAccountID: payeeAccountID,
        currency,
        // We don't translate reportName because the server response is always in English
        reportName: `${policyName} owes ${formattedTotal}`,
        stateNum,
        statusNum,
        total: storedTotal,
        nonReimbursableTotal: reimbursable ? 0 : storedTotal,
        notificationPreference: CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        parentReportID: chatReportID,
        lastVisibleActionCreated: DateUtils.getDBTime(),
    };

    // Get the approver/manager for this report to properly display the optimistic data
    const submitToAccountID = PolicyUtils.getSubmitToAccountID(policy, payeeAccountID);
    if (submitToAccountID) {
        expenseReport.managerID = submitToAccountID;
    }

    const titleReportField = getTitleReportField(getReportFieldsByPolicyID(policyID) ?? {});
    if (!!titleReportField && reportFieldsEnabled(expenseReport)) {
        expenseReport.reportName = populateOptimisticReportFormula(titleReportField.defaultValue, expenseReport, policy);
    }

    return expenseReport;
}

function getIOUSubmittedMessage(report: OnyxEntry<Report>) {
    const policy = getPolicy(report?.policyID);

    if (report?.ownerAccountID !== currentUserAccountID && policy.role === CONST.POLICY.ROLE.ADMIN) {
        const ownerPersonalDetail = getPersonalDetailsForAccountID(report?.ownerAccountID ?? 0);
        const ownerDisplayName = `${ownerPersonalDetail.displayName ?? ''}${ownerPersonalDetail.displayName !== ownerPersonalDetail.login ? ` (${ownerPersonalDetail.login})` : ''}`;

        return [
            {
                style: 'normal',
                text: 'You (on behalf of ',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
            {
                style: 'strong',
                text: ownerDisplayName,
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
            {
                style: 'normal',
                text: ' via admin-submit)',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
            {
                style: 'normal',
                text: ' submitted this report',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
            {
                style: 'normal',
                text: ' to ',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
            {
                style: 'strong',
                text: 'you',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ];
    }

    const submittedToPersonalDetail = getPersonalDetailsForAccountID(PolicyUtils.getSubmitToAccountID(policy, report?.ownerAccountID ?? 0));
    let submittedToDisplayName = `${submittedToPersonalDetail.displayName ?? ''}${
        submittedToPersonalDetail.displayName !== submittedToPersonalDetail.login ? ` (${submittedToPersonalDetail.login})` : ''
    }`;
    if (submittedToPersonalDetail?.accountID === currentUserAccountID) {
        submittedToDisplayName = 'yourself';
    }

    return [
        {
            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            style: 'strong',
            text: 'You',
        },
        {
            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            style: 'normal',
            text: ' submitted this report',
        },
        {
            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            style: 'normal',
            text: ' to ',
        },
        {
            type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            style: 'strong',
            text: submittedToDisplayName,
        },
    ];
}

/**
 * @param iouReportID - the report ID of the IOU report the action belongs to
 * @param type - IOUReportAction type. Can be oneOf(create, decline, cancel, pay, split)
 * @param total - IOU total in cents
 * @param comment - IOU comment
 * @param currency - IOU currency
 * @param paymentType - IOU paymentMethodType. Can be oneOf(Elsewhere, Expensify)
 * @param isSettlingUp - Whether we are settling up an IOU
 */
function getIOUReportActionMessage(iouReportID: string, type: string, total: number, comment: string, currency: string, paymentType = '', isSettlingUp = false): Message[] {
    const report = getReport(iouReportID);

    if (type === CONST.REPORT.ACTIONS.TYPE.SUBMITTED) {
        return getIOUSubmittedMessage(!isEmptyObject(report) ? report : null);
    }

    const amount =
        type === CONST.IOU.REPORT_ACTION_TYPE.PAY
            ? CurrencyUtils.convertToDisplayString(getMoneyRequestSpendBreakdown(!isEmptyObject(report) ? report : null).totalDisplaySpend, currency)
            : CurrencyUtils.convertToDisplayString(total, currency);

    let paymentMethodMessage;
    switch (paymentType) {
        case CONST.IOU.PAYMENT_TYPE.VBBA:
        case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            paymentMethodMessage = ' with Expensify';
            break;
        default:
            paymentMethodMessage = ` elsewhere`;
            break;
    }

    let iouMessage;
    switch (type) {
        case CONST.REPORT.ACTIONS.TYPE.APPROVED:
            iouMessage = `approved ${amount}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.CREATE:
            iouMessage = `submitted ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.TRACK:
            iouMessage = `tracking ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.SPLIT:
            iouMessage = `split ${amount}${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.DELETE:
            iouMessage = `deleted the ${amount} expense${comment && ` for ${comment}`}`;
            break;
        case CONST.IOU.REPORT_ACTION_TYPE.PAY:
            iouMessage = isSettlingUp ? `paid ${amount}${paymentMethodMessage}` : `sent ${amount}${comment && ` for ${comment}`}${paymentMethodMessage}`;
            break;
        default:
            break;
    }

    return [
        {
            html: lodashEscape(iouMessage),
            text: iouMessage ?? '',
            isEdited: false,
            type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
        },
    ];
}

/**
 * Builds an optimistic IOU reportAction object
 *
 * @param type - IOUReportAction type. Can be oneOf(create, delete, pay, split).
 * @param amount - IOU amount in cents.
 * @param currency
 * @param comment - User comment for the IOU.
 * @param participants - An array with participants details.
 * @param [transactionID] - Not required if the IOUReportAction type is 'pay'
 * @param [paymentType] - Only required if the IOUReportAction type is 'pay'. Can be oneOf(elsewhere, Expensify).
 * @param [iouReportID] - Only required if the IOUReportActions type is oneOf(decline, cancel, pay). Generates a randomID as default.
 * @param [isSettlingUp] - Whether we are settling up an IOU.
 * @param [isSendMoneyFlow] - Whether this is pay someone flow
 * @param [receipt]
 * @param [isOwnPolicyExpenseChat] - Whether this is an expense report create from the current user's policy expense chat
 */
function buildOptimisticIOUReportAction(
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>,
    amount: number,
    currency: string,
    comment: string,
    participants: Participant[],
    transactionID: string,
    paymentType?: PaymentMethodType,
    iouReportID = '',
    isSettlingUp = false,
    isSendMoneyFlow = false,
    receipt: Receipt = {},
    isOwnPolicyExpenseChat = false,
    created = DateUtils.getDBTime(),
    linkedExpenseReportAction: ReportAction | EmptyObject = {},
): OptimisticIOUReportAction {
    const IOUReportID = iouReportID || generateReportID();

    const originalMessage: IOUMessage = {
        amount,
        comment,
        currency,
        IOUTransactionID: transactionID,
        IOUReportID,
        type,
        whisperedTo: [CONST.IOU.RECEIPT_STATE.SCANREADY, CONST.IOU.RECEIPT_STATE.SCANNING].some((value) => value === receipt?.state) ? [currentUserAccountID ?? -1] : [],
    };

    if (type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // In pay someone flow, we store amount, comment, currency in IOUDetails when type = pay
        if (isSendMoneyFlow) {
            const keys = ['amount', 'comment', 'currency'] as const;
            keys.forEach((key) => {
                delete originalMessage[key];
            });
            originalMessage.IOUDetails = {amount, comment, currency};
            originalMessage.paymentType = paymentType;
        } else {
            // In case of pay someone action, we dont store the comment
            // and there is no single transctionID to link the action to.
            delete originalMessage.IOUTransactionID;
            delete originalMessage.comment;
            originalMessage.paymentType = paymentType;
        }
    }

    // IOUs of type split only exist in group DMs and those don't have an iouReport so we need to delete the IOUReportID key
    if (type === CONST.IOU.REPORT_ACTION_TYPE.SPLIT) {
        delete originalMessage.IOUReportID;
        // Split expense made from a policy expense chat only have the payee's accountID as the participant because the payer could be any policy admin
        if (isOwnPolicyExpenseChat) {
            originalMessage.participantAccountIDs = currentUserAccountID ? [currentUserAccountID] : [];
        } else {
            originalMessage.participantAccountIDs = currentUserAccountID
                ? [currentUserAccountID, ...participants.map((participant) => participant.accountID ?? -1)]
                : participants.map((participant) => participant.accountID ?? -1);
        }
    }

    return {
        ...linkedExpenseReportAction,
        actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(iouReportID, type, amount, comment, currency, paymentType, isSettlingUp),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic APPROVED report action with a randomly generated reportActionID.
 */
function buildOptimisticApprovedReportAction(amount: number, currency: string, expenseReportID: string): OptimisticApprovedReportAction {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.APPROVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.APPROVED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic MOVED report action with a randomly generated reportActionID.
 * This action is used when we move reports across workspaces.
 */
function buildOptimisticMovedReportAction(fromPolicyID: string, toPolicyID: string, newParentReportID: string, movedReportID: string, policyName: string): ReportAction {
    const originalMessage = {
        fromPolicyID,
        toPolicyID,
        newParentReportID,
        movedReportID,
    };

    const movedActionMessage = [
        {
            html: `moved the report to the <a href='${CONST.NEW_EXPENSIFY_URL}r/${newParentReportID}' target='_blank' rel='noreferrer noopener'>${policyName}</a> workspace`,
            text: `moved the report to the ${policyName} workspace`,
            type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
        },
    ];

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MOVED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachment: false,
        originalMessage,
        message: movedActionMessage,
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic SUBMITTED report action with a randomly generated reportActionID.
 *
 */
function buildOptimisticSubmittedReportAction(amount: number, currency: string, expenseReportID: string, adminAccountID: number | undefined): OptimisticSubmittedReportAction {
    const originalMessage = {
        amount,
        currency,
        expenseReportID,
    };

    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.SUBMITTED,
        actorAccountID: currentUserAccountID,
        adminAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachment: false,
        originalMessage,
        message: getIOUReportActionMessage(expenseReportID, CONST.REPORT.ACTIONS.TYPE.SUBMITTED, Math.abs(amount), '', currency),
        person: [
            {
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTime(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic report preview action with a randomly generated reportActionID.
 *
 * @param chatReport
 * @param iouReport
 * @param [comment] - User comment for the IOU.
 * @param [transaction] - optimistic first transaction of preview
 */
function buildOptimisticReportPreview(chatReport: OnyxEntry<Report>, iouReport: Report, comment = '', transaction: OnyxEntry<Transaction> = null, childReportID?: string): ReportAction {
    const hasReceipt = TransactionUtils.hasReceipt(transaction);
    const isReceiptBeingScanned = hasReceipt && TransactionUtils.isReceiptBeingScanned(transaction);
    const message = getReportPreviewMessage(iouReport);
    const created = DateUtils.getDBTime();
    return {
        reportActionID: NumberUtils.rand64(),
        reportID: chatReport?.reportID,
        actionName: CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        originalMessage: {
            linkedReportID: iouReport?.reportID,
            whisperedTo: isReceiptBeingScanned ? [currentUserAccountID ?? -1] : [],
        },
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        created,
        accountID: iouReport?.managerID ?? 0,
        // The preview is initially whispered if created with a receipt, so the actor is the current user as well
        actorAccountID: hasReceipt ? currentUserAccountID : iouReport?.managerID ?? 0,
        childReportID: childReportID ?? iouReport?.reportID,
        childMoneyRequestCount: 1,
        childLastMoneyRequestComment: comment,
        childRecentReceiptTransactionIDs: hasReceipt && !isEmptyObject(transaction) ? {[transaction?.transactionID ?? '']: created} : undefined,
    };
}

/**
 * Builds an optimistic ACTIONABLETRACKEXPENSEWHISPER action with a randomly generated reportActionID.
 */
function buildOptimisticActionableTrackExpenseWhisper(iouAction: OptimisticIOUReportAction, transactionID: string): ReportAction {
    const currentTime = DateUtils.getDBTime();
    const targetEmail = CONST.EMAIL.CONCIERGE;
    const actorAccountID = PersonalDetailsUtils.getAccountIDsByLogins([targetEmail])[0];
    const reportActionID = NumberUtils.rand64();
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.ACTIONABLE_TRACK_EXPENSE_WHISPER,
        actorAccountID,
        avatar: UserUtils.getDefaultAvatarURL(actorAccountID),
        created: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
        lastModified: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
        message: [
            {
                html: CONST.ACTIONABLE_TRACK_EXPENSE_WHISPER_MESSAGE,
                text: CONST.ACTIONABLE_TRACK_EXPENSE_WHISPER_MESSAGE,
                whisperedTo: [],
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        originalMessage: {
            lastModified: DateUtils.addMillisecondsFromDateTime(currentTime, 1),
            transactionID,
        },
        person: [
            {
                text: CONST.DISPLAY_NAME.EXPENSIFY_CONCIERGE,
                type: 'TEXT',
            },
        ],
        previousReportActionID: iouAction?.reportActionID,
        reportActionID,
        shouldShow: true,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic modified expense action with a randomly generated reportActionID.
 */
function buildOptimisticModifiedExpenseReportAction(
    transactionThread: OnyxEntry<Report>,
    oldTransaction: OnyxEntry<Transaction>,
    transactionChanges: TransactionChanges,
    isFromExpenseReport: boolean,
    policy: OnyxEntry<Policy>,
): OptimisticModifiedExpenseReportAction {
    const originalMessage = getModifiedExpenseOriginalMessage(oldTransaction, transactionChanges, isFromExpenseReport, policy);
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        isAttachment: false,
        message: [
            {
                // Currently we are composing the message from the originalMessage and message is only used in OldDot and not in the App
                text: 'You',
                style: 'strong',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        originalMessage,
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        reportActionID: NumberUtils.rand64(),
        reportID: transactionThread?.reportID,
        shouldShow: true,
    };
}

/**
 * Builds an optimistic modified expense action for a tracked expense move with a randomly generated reportActionID.
 * @param transactionThreadID - The reportID of the transaction thread
 * @param movedToReportID - The reportID of the report the transaction is moved to
 */
function buildOptimisticMovedTrackedExpenseModifiedReportAction(transactionThreadID: string, movedToReportID: string): OptimisticModifiedExpenseReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.MODIFIED_EXPENSE,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        isAttachment: false,
        message: [
            {
                // Currently we are composing the message from the originalMessage and message is only used in OldDot and not in the App
                text: 'You',
                style: 'strong',
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        originalMessage: {
            movedToReportID,
        },
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        reportActionID: NumberUtils.rand64(),
        reportID: transactionThreadID,
        shouldShow: true,
    };
}

/**
 * Updates a report preview action that exists for an IOU report.
 *
 * @param [comment] - User comment for the IOU.
 * @param [transaction] - optimistic newest transaction of a report preview
 *
 */
function updateReportPreview(
    iouReport: OnyxEntry<Report>,
    reportPreviewAction: ReportPreviewAction,
    isPayRequest = false,
    comment = '',
    transaction: OnyxEntry<Transaction> = null,
): ReportPreviewAction {
    const hasReceipt = TransactionUtils.hasReceipt(transaction);
    const recentReceiptTransactions = reportPreviewAction?.childRecentReceiptTransactionIDs ?? {};
    const transactionsToKeep = TransactionUtils.getRecentTransactions(recentReceiptTransactions);
    const previousTransactionsArray = Object.entries(recentReceiptTransactions ?? {}).map(([key, value]) => (transactionsToKeep.includes(key) ? {[key]: value} : null));
    const previousTransactions: Record<string, string> = {};

    for (const obj of previousTransactionsArray) {
        for (const key in obj) {
            if (obj) {
                previousTransactions[key] = obj[key];
            }
        }
    }

    const message = getReportPreviewMessage(iouReport, reportPreviewAction);
    return {
        ...reportPreviewAction,
        message: [
            {
                html: message,
                text: message,
                isEdited: false,
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
            },
        ],
        childLastMoneyRequestComment: comment || reportPreviewAction?.childLastMoneyRequestComment,
        childMoneyRequestCount: (reportPreviewAction?.childMoneyRequestCount ?? 0) + (isPayRequest ? 0 : 1),
        childRecentReceiptTransactionIDs: hasReceipt
            ? {
                  ...(transaction && {[transaction.transactionID]: transaction?.created}),
                  ...previousTransactions,
              }
            : recentReceiptTransactions,
        // As soon as we add a transaction without a receipt to the report, it will have ready expenses,
        // so we remove the whisper
        originalMessage: {
            ...(reportPreviewAction.originalMessage ?? {}),
            whisperedTo: hasReceipt ? reportPreviewAction?.originalMessage?.whisperedTo : [],
        },
    };
}

function buildOptimisticTaskReportAction(
    taskReportID: string,
    actionName: OriginalMessageActionName,
    message = '',
    actorAccountID = currentUserAccountID,
    createdOffset = 0,
): OptimisticTaskReportAction {
    const originalMessage = {
        taskReportID,
        type: actionName,
        text: message,
    };
    return {
        actionName,
        actorAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        isAttachment: false,
        originalMessage,
        message: [
            {
                text: message,
                taskReportID,
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
            },
        ],
        person: [
            {
                style: 'strong',
                text: currentUserPersonalDetails?.displayName ?? String(currentUserAccountID),
                type: 'TEXT',
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
        created: DateUtils.getDBTimeWithSkew(Date.now() + createdOffset),
        isFirstItem: false,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
    };
}

/**
 * Builds an optimistic chat report with a randomly generated reportID and as much information as we currently have
 */
function buildOptimisticChatReport(
    participantList: number[],
    reportName: string = CONST.REPORT.DEFAULT_REPORT_NAME,
    chatType: ValueOf<typeof CONST.REPORT.CHAT_TYPE> | undefined = undefined,
    policyID: string = CONST.POLICY.OWNER_EMAIL_FAKE,
    ownerAccountID: number = CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
    isOwnPolicyExpenseChat = false,
    oldPolicyName = '',
    visibility: ValueOf<typeof CONST.REPORT.VISIBILITY> | undefined = undefined,
    writeCapability: ValueOf<typeof CONST.REPORT.WRITE_CAPABILITIES> | undefined = undefined,
    notificationPreference: NotificationPreference = CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
    parentReportActionID = '',
    parentReportID = '',
    description = '',
    avatarUrl = '',
    optimisticReportID = '',
    shouldShowParticipants = true,
): OptimisticChatReport {
    const participants = participantList.reduce((reportParticipants: Participants, accountID: number) => {
        const participant: ReportParticipant = {
            hidden: !shouldShowParticipants,
            role: accountID === currentUserAccountID ? CONST.REPORT.ROLE.ADMIN : CONST.REPORT.ROLE.MEMBER,
        };
        // eslint-disable-next-line no-param-reassign
        reportParticipants[accountID] = participant;
        return reportParticipants;
    }, {} as Participants);
    const currentTime = DateUtils.getDBTime();
    const isNewlyCreatedWorkspaceChat = chatType === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT && isOwnPolicyExpenseChat;
    const optimisticChatReport: OptimisticChatReport = {
        isOptimisticReport: true,
        type: CONST.REPORT.TYPE.CHAT,
        chatType,
        isOwnPolicyExpenseChat,
        isPinned: reportName === CONST.REPORT.WORKSPACE_CHAT_ROOMS.ADMINS || isNewlyCreatedWorkspaceChat,
        lastActorAccountID: 0,
        lastMessageTranslationKey: '',
        lastMessageHtml: '',
        lastMessageText: undefined,
        lastReadTime: currentTime,
        lastVisibleActionCreated: currentTime,
        notificationPreference,
        oldPolicyName,
        ownerAccountID: ownerAccountID || CONST.REPORT.OWNER_ACCOUNT_ID_FAKE,
        parentReportActionID,
        parentReportID,
        participants,
        policyID,
        reportID: optimisticReportID || generateReportID(),
        reportName,
        stateNum: 0,
        statusNum: 0,
        visibility,
        description,
        writeCapability,
        avatarUrl,
    };

    if (chatType === CONST.REPORT.CHAT_TYPE.INVOICE) {
        // TODO: update to support workspace as an invoice receiver when workspace-to-workspace invoice room implemented
        optimisticChatReport.invoiceReceiver = {
            type: 'individual',
            accountID: participantList[0],
        };
    }

    return optimisticChatReport;
}

function buildOptimisticGroupChatReport(participantAccountIDs: number[], reportName: string, avatarUri: string, optimisticReportID?: string) {
    return buildOptimisticChatReport(
        participantAccountIDs,
        reportName,
        CONST.REPORT.CHAT_TYPE.GROUP,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        avatarUri,
        optimisticReportID,
    );
}

/**
 * Returns the necessary reportAction onyx data to indicate that the chat has been created optimistically
 * @param [created] - Action created time
 */
function buildOptimisticCreatedReportAction(emailCreatingAction: string, created = DateUtils.getDBTime()): OptimisticCreatedReportAction {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.CREATED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailCreatingAction,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' created this report',
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the room has been renamed
 */
function buildOptimisticRenamedRoomReportAction(newName: string, oldName: string): OptimisticRenamedReportAction {
    const now = DateUtils.getDBTime();
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.RENAMED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: 'You',
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ` renamed this report. New title is '${newName}' (previously '${oldName}').`,
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        originalMessage: {
            oldName,
            newName,
            html: `Room renamed to ${newName}`,
            lastModified: now,
        },
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: now,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been put on hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticHoldReportAction(created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.HOLD,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: Localize.translateLocal('iou.heldExpense'),
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been put on hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticHoldReportActionComment(comment: string, created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: comment,
                html: comment, // as discussed on https://github.com/Expensify/App/pull/39452 we will not support HTML for now
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that the transaction has been removed from hold optimistically
 * @param [created] - Action created time
 */
function buildOptimisticUnHoldReportAction(created = DateUtils.getDBTime()): OptimisticHoldReportAction {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.UNHOLD,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: Localize.translateLocal('iou.unheldExpense'),
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created,
        shouldShow: true,
    };
}

function buildOptimisticEditedTaskFieldReportAction({title, description}: Task): OptimisticEditedTaskReportAction {
    // We do not modify title & description in one request, so we need to create a different optimistic action for each field modification
    let field = '';
    let value = '';
    if (title !== undefined) {
        field = 'task title';
        value = title;
    } else if (description !== undefined) {
        field = 'description';
        value = description;
    }

    let changelog = 'edited this task';
    if (field && value) {
        changelog = `updated the ${field} to ${value}`;
    } else if (field) {
        changelog = `removed the ${field}`;
    }

    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.TASK_EDITED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: changelog,
                html: description ? getParsedComment(changelog) : changelog,
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        shouldShow: false,
    };
}

function buildOptimisticChangedTaskAssigneeReportAction(assigneeAccountID: number): OptimisticEditedTaskReportAction {
    return {
        reportActionID: NumberUtils.rand64(),
        actionName: CONST.REPORT.ACTIONS.TYPE.TASK_EDITED,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        actorAccountID: currentUserAccountID,
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                text: `assigned to ${getDisplayNameForParticipant(assigneeAccountID)}`,
                html: `assigned to <mention-user accountID=${assigneeAccountID}></mention-user>`,
            },
        ],
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        shouldShow: false,
    };
}

/**
 * Returns the necessary reportAction onyx data to indicate that a chat has been archived
 *
 * @param reason - A reason why the chat has been archived
 */
function buildOptimisticClosedReportAction(emailClosingReport: string, policyName: string, reason: string = CONST.REPORT.ARCHIVE_REASON.DEFAULT): OptimisticClosedReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.CLOSED,
        actorAccountID: currentUserAccountID,
        automatic: false,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: emailClosingReport,
            },
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ' closed this report',
            },
        ],
        originalMessage: {
            policyName,
            reason,
        },
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
    };
}

/**
 * Returns an optimistic Dismissed Violation Report Action. Use the originalMessage customize this to the type of
 * violation being dismissed.
 */
function buildOptimisticDismissedViolationReportAction(originalMessage: OriginalMessageDismissedViolation['originalMessage']): OptimisticDismissedViolationReportAction {
    return {
        actionName: CONST.REPORT.ACTIONS.TYPE.DISMISSED_VIOLATION,
        actorAccountID: currentUserAccountID,
        avatar: getCurrentUserAvatar(),
        created: DateUtils.getDBTime(),
        message: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'normal',
                text: ReportActionsUtils.getDismissedViolationMessageText(originalMessage),
            },
        ],
        originalMessage,
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        person: [
            {
                type: CONST.REPORT.MESSAGE.TYPE.TEXT,
                style: 'strong',
                text: getCurrentUserDisplayNameOrEmail(),
            },
        ],
        reportActionID: NumberUtils.rand64(),
        shouldShow: true,
    };
}

function buildOptimisticWorkspaceChats(policyID: string, policyName: string, expenseReportId?: string): OptimisticWorkspaceChats {
    const announceChatData = buildOptimisticChatReport(
        currentUserAccountID ? [currentUserAccountID] : [],
        CONST.REPORT.WORKSPACE_CHAT_ROOMS.ANNOUNCE,
        CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE,
        policyID,
        CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        false,
        policyName,
        undefined,
        undefined,

        // #announce contains all policy members so notifying always should be opt-in only.
        CONST.REPORT.NOTIFICATION_PREFERENCE.DAILY,
    );
    const announceChatReportID = announceChatData.reportID;
    const announceCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    const announceReportActionData = {
        [announceCreatedAction.reportActionID]: announceCreatedAction,
    };
    const pendingChatMembers = getPendingChatMembers(currentUserAccountID ? [currentUserAccountID] : [], [], CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD);
    const adminsChatData = {
        ...buildOptimisticChatReport(
            [currentUserAccountID ?? -1],
            CONST.REPORT.WORKSPACE_CHAT_ROOMS.ADMINS,
            CONST.REPORT.CHAT_TYPE.POLICY_ADMINS,
            policyID,
            CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
            false,
            policyName,
        ),
        pendingChatMembers,
    };
    const adminsChatReportID = adminsChatData.reportID;
    const adminsCreatedAction = buildOptimisticCreatedReportAction(CONST.POLICY.OWNER_EMAIL_FAKE);
    const adminsReportActionData = {
        [adminsCreatedAction.reportActionID]: adminsCreatedAction,
    };

    const expenseChatData = buildOptimisticChatReport(
        [currentUserAccountID ?? -1],
        '',
        CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
        policyID,
        currentUserAccountID,
        true,
        policyName,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        expenseReportId,
    );
    const expenseChatReportID = expenseChatData.reportID;
    const expenseReportCreatedAction = buildOptimisticCreatedReportAction(currentUserEmail ?? '');
    const expenseReportActionData = {
        [expenseReportCreatedAction.reportActionID]: expenseReportCreatedAction,
    };

    return {
        announceChatReportID,
        announceChatData,
        announceReportActionData,
        announceCreatedReportActionID: announceCreatedAction.reportActionID,
        adminsChatReportID,
        adminsChatData,
        adminsReportActionData,
        adminsCreatedReportActionID: adminsCreatedAction.reportActionID,
        expenseChatReportID,
        expenseChatData,
        expenseReportActionData,
        expenseCreatedReportActionID: expenseReportCreatedAction.reportActionID,
    };
}

/**
 * Builds an optimistic Task Report with a randomly generated reportID
 *
 * @param ownerAccountID - Account ID of the person generating the Task.
 * @param assigneeAccountID - AccountID of the other person participating in the Task.
 * @param parentReportID - Report ID of the chat where the Task is.
 * @param title - Task title.
 * @param description - Task description.
 * @param policyID - PolicyID of the parent report
 */

function buildOptimisticTaskReport(
    ownerAccountID: number,
    assigneeAccountID = 0,
    parentReportID?: string,
    title?: string,
    description?: string,
    policyID: string = CONST.POLICY.OWNER_EMAIL_FAKE,
    notificationPreference: NotificationPreference = CONST.REPORT.NOTIFICATION_PREFERENCE.ALWAYS,
): OptimisticTaskReport {
    const participants: Participants = {
        [ownerAccountID]: {
            hidden: false,
        },
    };

    if (assigneeAccountID) {
        participants[assigneeAccountID] = {hidden: false};
    }

    return {
        reportID: generateReportID(),
        reportName: title,
        description: getParsedComment(description ?? ''),
        ownerAccountID,
        participants,
        managerID: assigneeAccountID,
        type: CONST.REPORT.TYPE.TASK,
        parentReportID,
        policyID,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
        notificationPreference,
        lastVisibleActionCreated: DateUtils.getDBTime(),
    };
}

/**
 * A helper method to create transaction thread
 *
 * @param reportAction - the parent IOU report action from which to create the thread
 * @param moneyRequestReport - the report which the report action belongs to
 */
function buildTransactionThread(
    reportAction: OnyxEntry<ReportAction | OptimisticIOUReportAction>,
    moneyRequestReport: OnyxEntry<Report>,
    existingTransactionThreadReportID?: string,
): OptimisticChatReport {
    const participantAccountIDs = [...new Set([currentUserAccountID, Number(reportAction?.actorAccountID)])].filter(Boolean) as number[];
    const existingTransactionThreadReport = getReport(existingTransactionThreadReportID);

    if (existingTransactionThreadReportID && existingTransactionThreadReport) {
        return {
            ...existingTransactionThreadReport,
            isOptimisticReport: true,
            parentReportActionID: reportAction?.reportActionID,
            parentReportID: moneyRequestReport?.reportID,
            reportName: getTransactionReportName(reportAction),
            policyID: moneyRequestReport?.policyID,
        };
    }

    return buildOptimisticChatReport(
        participantAccountIDs,
        getTransactionReportName(reportAction),
        undefined,
        moneyRequestReport?.policyID,
        CONST.POLICY.OWNER_ACCOUNT_ID_FAKE,
        false,
        '',
        undefined,
        undefined,
        CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN,
        reportAction?.reportActionID,
        moneyRequestReport?.reportID,
        '',
        '',
        '',
        false,
    );
}

/**
 * Build optimistic expense entities:
 *
 * 1. CREATED action for the chatReport
 * 2. CREATED action for the iouReport
 * 3. IOU action for the iouReport linked to the transaction thread via `childReportID`
 * 4. Transaction Thread linked to the IOU action via `parentReportActionID`
 * 5. CREATED action for the Transaction Thread
 */
function buildOptimisticMoneyRequestEntities(
    iouReport: Report,
    type: ValueOf<typeof CONST.IOU.REPORT_ACTION_TYPE>,
    amount: number,
    currency: string,
    comment: string,
    payeeEmail: string,
    participants: Participant[],
    transactionID: string,
    paymentType?: PaymentMethodType,
    isSettlingUp = false,
    isSendMoneyFlow = false,
    receipt: Receipt = {},
    isOwnPolicyExpenseChat = false,
    isPersonalTrackingExpense?: boolean,
    existingTransactionThreadReportID?: string,
    linkedTrackedExpenseReportAction?: ReportAction,
): [OptimisticCreatedReportAction, OptimisticCreatedReportAction, OptimisticIOUReportAction, OptimisticChatReport, OptimisticCreatedReportAction | EmptyObject] {
    const createdActionForChat = buildOptimisticCreatedReportAction(payeeEmail);

    // The `CREATED` action must be optimistically generated before the IOU action so that it won't appear after the IOU action in the chat.
    const iouActionCreationTime = DateUtils.getDBTime();
    const createdActionForIOUReport = buildOptimisticCreatedReportAction(payeeEmail, DateUtils.subtractMillisecondsFromDateTime(iouActionCreationTime, 1));

    const iouAction = buildOptimisticIOUReportAction(
        type,
        amount,
        currency,
        comment,
        participants,
        transactionID,
        paymentType,
        isPersonalTrackingExpense ? '0' : iouReport.reportID,
        isSettlingUp,
        isSendMoneyFlow,
        receipt,
        isOwnPolicyExpenseChat,
        iouActionCreationTime,
        linkedTrackedExpenseReportAction,
    );

    // Create optimistic transactionThread and the `CREATED` action for it, if existingTransactionThreadReportID is undefined
    const transactionThread = buildTransactionThread(iouAction, iouReport, existingTransactionThreadReportID);
    const createdActionForTransactionThread = existingTransactionThreadReportID ? {} : buildOptimisticCreatedReportAction(payeeEmail);

    // The IOU action and the transactionThread are co-dependent as parent-child, so we need to link them together
    iouAction.childReportID = existingTransactionThreadReportID ?? transactionThread.reportID;

    return [createdActionForChat, createdActionForIOUReport, iouAction, transactionThread, createdActionForTransactionThread];
}

// Check if the report is empty, meaning it has no visible messages (i.e. only a "created" report action).
function isEmptyReport(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return true;
    }
    const lastVisibleMessage = ReportActionsUtils.getLastVisibleMessage(report.reportID);
    return !report.lastMessageText && !report.lastMessageTranslationKey && !lastVisibleMessage.lastMessageText && !lastVisibleMessage.lastMessageTranslationKey;
}

function isUnread(report: OnyxEntry<Report>): boolean {
    if (!report) {
        return false;
    }

    if (isEmptyReport(report)) {
        return false;
    }
    // lastVisibleActionCreated and lastReadTime are both datetime strings and can be compared directly
    const lastVisibleActionCreated = report.lastVisibleActionCreated ?? '';
    const lastReadTime = report.lastReadTime ?? '';
    const lastMentionedTime = report.lastMentionedTime ?? '';

    // If the user was mentioned and the comment got deleted the lastMentionedTime will be more recent than the lastVisibleActionCreated
    return lastReadTime < lastVisibleActionCreated || lastReadTime < lastMentionedTime;
}

function isIOUOwnedByCurrentUser(report: OnyxEntry<Report>, allReportsDict: OnyxCollection<Report> = null): boolean {
    const allAvailableReports = allReportsDict ?? allReports;
    if (!report || !allAvailableReports) {
        return false;
    }

    let reportToLook = report;
    if (report.iouReportID) {
        const iouReport = allAvailableReports[`${ONYXKEYS.COLLECTION.REPORT}${report.iouReportID}`];
        if (iouReport) {
            reportToLook = iouReport;
        }
    }

    return reportToLook.ownerAccountID === currentUserAccountID;
}

/**
 * Assuming the passed in report is a default room, lets us know whether we can see it or not, based on permissions and
 * the various subsets of users we've allowed to use default rooms.
 */
function canSeeDefaultRoom(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>, betas: OnyxEntry<Beta[]>): boolean {
    // Include archived rooms
    if (isArchivedRoom(report)) {
        return true;
    }

    // Include default rooms for free plan policies (domain rooms aren't included in here because they do not belong to a policy)
    if (getPolicyType(report, policies) === CONST.POLICY.TYPE.FREE) {
        return true;
    }

    // If the room has an assigned guide, it can be seen.
    if (hasExpensifyGuidesEmails(Object.keys(report?.participants ?? {}).map(Number))) {
        return true;
    }

    // Include any admins and announce rooms, since only non partner-managed domain rooms are on the beta now.
    if (isAdminRoom(report) || isAnnounceRoom(report)) {
        return true;
    }

    // For all other cases, just check that the user belongs to the default rooms beta
    return Permissions.canUseDefaultRooms(betas ?? []);
}

function canAccessReport(report: OnyxEntry<Report>, policies: OnyxCollection<Policy>, betas: OnyxEntry<Beta[]>): boolean {
    // We hide default rooms (it's basically just domain rooms now) from people who aren't on the defaultRooms beta.
    if (isDefaultRoom(report) && !canSeeDefaultRoom(report, policies, betas)) {
        return false;
    }

    if (report?.errorFields?.notFound) {
        return false;
    }

    return true;
}

/**
 * Check if the report is the parent report of the currently viewed report or at least one child report has report action
 */
function shouldHideReport(report: OnyxEntry<Report>, currentReportId: string): boolean {
    const currentReport = getReport(currentReportId);
    const parentReport = getParentReport(!isEmptyObject(currentReport) ? currentReport : null);
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report?.reportID}`] ?? {};
    const isChildReportHasComment = Object.values(reportActions ?? {})?.some((reportAction) => (reportAction?.childVisibleActionCount ?? 0) > 0);
    return parentReport?.reportID !== report?.reportID && !isChildReportHasComment;
}

/**
 * Checks to see if a report's parentAction is an expense that contains a violation type of either violation or warning
 */
function doesTransactionThreadHaveViolations(report: OnyxEntry<Report>, transactionViolations: OnyxCollection<TransactionViolation[]>, parentReportAction: OnyxEntry<ReportAction>): boolean {
    if (parentReportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.IOU) {
        return false;
    }
    const {IOUTransactionID, IOUReportID} = parentReportAction.originalMessage ?? {};
    if (!IOUTransactionID || !IOUReportID) {
        return false;
    }
    if (!isCurrentUserSubmitter(IOUReportID)) {
        return false;
    }
    if (report?.stateNum !== CONST.REPORT.STATE_NUM.OPEN && report?.stateNum !== CONST.REPORT.STATE_NUM.SUBMITTED) {
        return false;
    }
    return TransactionUtils.hasViolation(IOUTransactionID, transactionViolations) || TransactionUtils.hasWarningTypeViolation(IOUTransactionID, transactionViolations);
}

/**
 * Checks if we should display violation - we display violations when the expense has violation and it is not settled
 */
function shouldDisplayTransactionThreadViolations(
    report: OnyxEntry<Report>,
    transactionViolations: OnyxCollection<TransactionViolation[]>,
    parentReportAction: OnyxEntry<ReportAction>,
): boolean {
    const {IOUReportID} = (parentReportAction?.originalMessage as IOUMessage) ?? {};
    if (isSettled(IOUReportID)) {
        return false;
    }
    return doesTransactionThreadHaveViolations(report, transactionViolations, parentReportAction);
}

/**
 * Checks to see if a report contains a violation
 */
function hasViolations(reportID: string, transactionViolations: OnyxCollection<TransactionViolation[]>): boolean {
    const transactions = TransactionUtils.getAllReportTransactions(reportID);
    return transactions.some((transaction) => TransactionUtils.hasViolation(transaction.transactionID, transactionViolations));
}

/**
 * Checks to see if a report contains a violation of type `warning`
 */
function hasWarningTypeViolations(reportID: string, transactionViolations: OnyxCollection<TransactionViolation[]>): boolean {
    const transactions = TransactionUtils.getAllReportTransactions(reportID);
    return transactions.some((transaction) => TransactionUtils.hasWarningTypeViolation(transaction.transactionID, transactionViolations));
}

/**
 * Takes several pieces of data from Onyx and evaluates if a report should be shown in the option list (either when searching
 * for reports or the reports shown in the LHN).
 *
 * This logic is very specific and the order of the logic is very important. It should fail quickly in most cases and also
 * filter out the majority of reports before filtering out very specific minority of reports.
 */
function shouldReportBeInOptionList({
    report,
    currentReportId,
    isInFocusMode,
    betas,
    policies,
    excludeEmptyChats,
    doesReportHaveViolations,
    includeSelfDM = false,
}: {
    report: OnyxEntry<Report>;
    currentReportId: string;
    isInFocusMode: boolean;
    betas: OnyxEntry<Beta[]>;
    policies: OnyxCollection<Policy>;
    excludeEmptyChats: boolean;
    doesReportHaveViolations: boolean;
    includeSelfDM?: boolean;
}) {
    const isInDefaultMode = !isInFocusMode;
    // Exclude reports that have no data because there wouldn't be anything to show in the option item.
    // This can happen if data is currently loading from the server or a report is in various stages of being created.
    // This can also happen for anyone accessing a public room or archived room for which they don't have access to the underlying policy.
    // Optionally exclude reports that do not belong to currently active workspace

    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);

    if (
        !report?.reportID ||
        !report?.type ||
        report?.reportName === undefined ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        report?.isHidden ||
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        participantAccountIDs.includes(CONST.ACCOUNT_ID.NOTIFICATIONS) ||
        (participantAccountIDs.length === 0 &&
            !isChatThread(report) &&
            !isPublicRoom(report) &&
            !isUserCreatedPolicyRoom(report) &&
            !isArchivedRoom(report) &&
            !isMoneyRequestReport(report) &&
            !isTaskReport(report) &&
            !isSelfDM(report) &&
            !isSystemChat(report) &&
            !isGroupChat(report) &&
            !isInvoiceRoom(report))
    ) {
        return false;
    }

    if (!canAccessReport(report, policies, betas)) {
        return false;
    }

    // If this is a transaction thread associated with a report that only has one transaction, omit it
    if (isOneTransactionThread(report.reportID, report.parentReportID ?? '0')) {
        return false;
    }

    // Include the currently viewed report. If we excluded the currently viewed report, then there
    // would be no way to highlight it in the options list and it would be confusing to users because they lose
    // a sense of context.
    if (report.reportID === currentReportId) {
        return true;
    }

    // Retrieve the draft comment for the report and convert it to a boolean
    const hasDraftComment = hasValidDraftComment(report.reportID);

    // Include reports that are relevant to the user in any view mode. Criteria include having a draft or having a GBR showing.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    if (hasDraftComment || requiresAttentionFromCurrentUser(report)) {
        return true;
    }

    const isEmptyChat = isEmptyReport(report);
    const canHideReport = shouldHideReport(report, currentReportId);

    // Include reports if they are pinned
    if (report.isPinned) {
        return true;
    }

    const reportIsSettled = report.statusNum === CONST.REPORT.STATUS_NUM.REIMBURSED;

    // Always show IOU reports with violations unless they are reimbursed
    if (isExpenseRequest(report) && doesReportHaveViolations && !reportIsSettled) {
        return true;
    }

    // Hide only chat threads that haven't been commented on (other threads are actionable)
    if (isChatThread(report) && canHideReport && isEmptyChat) {
        return false;
    }

    // Include reports that have errors from trying to add a workspace
    // If we excluded it, then the red-brock-road pattern wouldn't work for the user to resolve the error
    if (report.errorFields?.addWorkspaceRoom) {
        return true;
    }

    // All unread chats (even archived ones) in GSD mode will be shown. This is because GSD mode is specifically for focusing the user on the most relevant chats, primarily, the unread ones
    if (isInFocusMode) {
        return isUnread(report) && report.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.MUTE;
    }

    // Archived reports should always be shown when in default (most recent) mode. This is because you should still be able to access and search for the chats to find them.
    if (isInDefaultMode && isArchivedRoom(report)) {
        return true;
    }

    // Hide chats between two users that haven't been commented on from the LNH
    if (excludeEmptyChats && isEmptyChat && isChatReport(report) && !isChatRoom(report) && !isPolicyExpenseChat(report) && !isSystemChat(report) && !isGroupChat(report) && canHideReport) {
        return false;
    }

    if (isSelfDM(report)) {
        return includeSelfDM;
    }

    return true;
}

/**
 * Attempts to find a report in onyx with the provided list of participants. Does not include threads, task, expense, room, and policy expense chat.
 */
function getChatByParticipants(newParticipantList: number[], reports: OnyxCollection<Report> = allReports): OnyxEntry<Report> {
    const sortedNewParticipantList = newParticipantList.sort();
    return (
        Object.values(reports ?? {}).find((report) => {
            const participantAccountIDs = Object.keys(report?.participants ?? {});

            // If the report has been deleted, or there are no participants (like an empty #admins room) then skip it
            if (
                participantAccountIDs.length === 0 ||
                isChatThread(report) ||
                isTaskReport(report) ||
                isMoneyRequestReport(report) ||
                isChatRoom(report) ||
                isPolicyExpenseChat(report) ||
                isGroupChat(report)
            ) {
                return false;
            }

            const sortedParticipantsAccountIDs = participantAccountIDs.map(Number).sort();

            // Only return the chat if it has all the participants
            return lodashIsEqual(sortedNewParticipantList, sortedParticipantsAccountIDs);
        }) ?? null
    );
}

/**
 * Attempts to find an invoice chat report in onyx with the provided policyID and receiverID.
 */
function getInvoiceChatByParticipants(policyID: string, receiverID: string | number, reports: OnyxCollection<Report> = allReports): OnyxEntry<Report> {
    return (
        Object.values(reports ?? {}).find((report) => {
            if (!report || !isInvoiceRoom(report)) {
                return false;
            }

            const isSameReceiver =
                report.invoiceReceiver &&
                (('accountID' in report.invoiceReceiver && report.invoiceReceiver.accountID === receiverID) ||
                    ('policyID' in report.invoiceReceiver && report.invoiceReceiver.policyID === receiverID));

            return report.policyID === policyID && isSameReceiver;
        }) ?? null
    );
}

/**
 * Attempts to find a policy expense report in onyx that is owned by ownerAccountID in a given policy
 */
function getPolicyExpenseChat(ownerAccountID: number, policyID: string): OnyxEntry<Report> {
    return (
        Object.values(allReports ?? {}).find((report: OnyxEntry<Report>) => {
            // If the report has been deleted, then skip it
            if (!report) {
                return false;
            }

            return report.policyID === policyID && isPolicyExpenseChat(report) && report.ownerAccountID === ownerAccountID;
        }) ?? null
    );
}

function getAllPolicyReports(policyID: string): Array<OnyxEntry<Report>> {
    return Object.values(allReports ?? {}).filter((report) => report?.policyID === policyID);
}

/**
 * Returns true if Chronos is one of the chat participants (1:1)
 */
function chatIncludesChronos(report: OnyxEntry<Report> | EmptyObject): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    return participantAccountIDs.includes(CONST.ACCOUNT_ID.CHRONOS);
}

/**
 * Can only flag if:
 *
 * - It was written by someone else and isn't a whisper
 * - It's a welcome message whisper
 * - It's an ADD_COMMENT that is not an attachment
 */
function canFlagReportAction(reportAction: OnyxEntry<ReportAction>, reportID: string | undefined): boolean {
    let report = getReport(reportID);

    // If the childReportID exists in reportAction and is equal to the reportID,
    // the report action being evaluated is the parent report action in a thread, and we should get the parent report to evaluate instead.
    if (reportAction?.childReportID?.toString() === reportID?.toString()) {
        report = getReport(report?.parentReportID);
    }
    const isCurrentUserAction = reportAction?.actorAccountID === currentUserAccountID;
    if (ReportActionsUtils.isWhisperAction(reportAction)) {
        // Allow flagging whispers that are sent by other users
        if (!isCurrentUserAction && reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE) {
            return true;
        }

        // Disallow flagging the rest of whisper as they are sent by us
        return false;
    }

    return Boolean(
        !isCurrentUserAction &&
            reportAction?.actionName === CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT &&
            !ReportActionsUtils.isDeletedAction(reportAction) &&
            !ReportActionsUtils.isCreatedTaskReportAction(reportAction) &&
            !isEmptyObject(report) &&
            report &&
            isAllowedToComment(report),
    );
}

/**
 * Whether flag comment page should show
 */
function shouldShowFlagComment(reportAction: OnyxEntry<ReportAction>, report: OnyxEntry<Report>): boolean {
    return (
        canFlagReportAction(reportAction, report?.reportID) &&
        !isArchivedRoom(report) &&
        !chatIncludesChronos(report) &&
        !isConciergeChatReport(report) &&
        reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE
    );
}

/**
 * @param sortedAndFilteredReportActions - reportActions for the report, sorted newest to oldest, and filtered for only those that should be visible
 */
function getNewMarkerReportActionID(report: OnyxEntry<Report>, sortedAndFilteredReportActions: ReportAction[]): string {
    if (!isUnread(report)) {
        return '';
    }

    const newMarkerIndex = lodashFindLastIndex(sortedAndFilteredReportActions, (reportAction) => (reportAction.created ?? '') > (report?.lastReadTime ?? ''));

    return 'reportActionID' in sortedAndFilteredReportActions[newMarkerIndex] ? sortedAndFilteredReportActions[newMarkerIndex].reportActionID : '';
}

/**
 * Performs the markdown conversion, and replaces code points > 127 with C escape sequences
 * Used for compatibility with the backend auth validator for AddComment, and to account for MD in comments
 * @returns The comment's total length as seen from the backend
 */
function getCommentLength(textComment: string, parsingDetails?: ParsingDetails): number {
    return getParsedComment(textComment, parsingDetails)
        .replace(/[^ -~]/g, '\\u????')
        .trim().length;
}

function getRouteFromLink(url: string | null): string {
    if (!url) {
        return '';
    }

    // Get the reportID from URL
    let route = url;
    const localWebAndroidRegEx = /^(https:\/\/([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3}))/;
    linkingConfig.prefixes.forEach((prefix) => {
        if (route.startsWith(prefix)) {
            route = route.replace(prefix, '');
        } else if (localWebAndroidRegEx.test(route)) {
            route = route.replace(localWebAndroidRegEx, '');
        } else {
            return;
        }

        // Remove the port if it's a localhost URL
        if (/^:\d+/.test(route)) {
            route = route.replace(/:\d+/, '');
        }

        // Remove the leading slash if exists
        if (route.startsWith('/')) {
            route = route.replace('/', '');
        }
    });
    return route;
}

function parseReportRouteParams(route: string): ReportRouteParams {
    let parsingRoute = route;
    if (parsingRoute.at(0) === '/') {
        // remove the first slash
        parsingRoute = parsingRoute.slice(1);
    }

    if (!parsingRoute.startsWith(Url.addTrailingForwardSlash(ROUTES.REPORT))) {
        return {reportID: '', isSubReportPageRoute: false};
    }

    const pathSegments = parsingRoute.split('/');

    const reportIDSegment = pathSegments[1];
    const hasRouteReportActionID = !Number.isNaN(Number(reportIDSegment));

    // Check for "undefined" or any other unwanted string values
    if (!reportIDSegment || reportIDSegment === 'undefined') {
        return {reportID: '', isSubReportPageRoute: false};
    }

    return {
        reportID: reportIDSegment,
        isSubReportPageRoute: pathSegments.length > 2 && !hasRouteReportActionID,
    };
}

function getReportIDFromLink(url: string | null): string {
    const route = getRouteFromLink(url);
    const {reportID, isSubReportPageRoute} = parseReportRouteParams(route);
    if (isSubReportPageRoute) {
        // We allow the Sub-Report deep link routes (settings, details, etc.) to be handled by their respective component pages
        return '';
    }
    return reportID;
}

/**
 * Get the report policyID given a reportID
 */
function getReportPolicyID(reportID?: string): string | undefined {
    return originalGetReportPolicyID(reportID);
}

/**
 * Check if the chat report is linked to an iou that is waiting for the current user to add a credit bank account.
 */
function hasIOUWaitingOnCurrentUserBankAccount(chatReport: OnyxEntry<Report>): boolean {
    if (chatReport?.iouReportID) {
        const iouReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${chatReport?.iouReportID}`];
        if (iouReport?.isWaitingOnBankAccount && iouReport?.ownerAccountID === currentUserAccountID) {
            return true;
        }
    }

    return false;
}

/**
 * Users can submit an expense:
 * - in policy expense chats only if they are in a role of a member in the chat (in other words, if it's their policy expense chat)
 * - in an open or submitted expense report tied to a policy expense chat the user owns
 *     - employee can submit expenses in a submitted expense report only if the policy has Instant Submit settings turned on
 * - in an IOU report, which is not settled yet
 * - in a 1:1 DM chat
 */
function canRequestMoney(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, otherParticipants: number[]): boolean {
    // User cannot submit expenses in a chat thread, task report or in a chat room
    if (isChatThread(report) || isTaskReport(report) || isChatRoom(report) || isSelfDM(report) || isGroupChat(report)) {
        return false;
    }

    // Users can only submit expenses in DMs if they are a 1:1 DM
    if (isDM(report)) {
        return otherParticipants.length === 1;
    }

    // Prevent requesting money if pending IOU report waiting for their bank account already exists
    if (hasIOUWaitingOnCurrentUserBankAccount(report)) {
        return false;
    }

    let isOwnPolicyExpenseChat = report?.isOwnPolicyExpenseChat ?? false;
    if (isExpenseReport(report) && getParentReport(report)) {
        isOwnPolicyExpenseChat = Boolean(getParentReport(report)?.isOwnPolicyExpenseChat);
    }

    // In case there are no other participants than the current user and it's not user's own policy expense chat, they can't submit expenses from such report
    if (otherParticipants.length === 0 && !isOwnPolicyExpenseChat) {
        return false;
    }

    // User can submit expenses in any IOU report, unless paid, but the user can only submit expenses in an expense report
    // which is tied to their workspace chat.
    if (isMoneyRequestReport(report)) {
        const canAddTransactions = canAddOrDeleteTransactions(report);
        return isReportInGroupPolicy(report) ? isOwnPolicyExpenseChat && canAddTransactions : canAddTransactions;
    }

    // In the case of policy expense chat, users can only submit expenses from their own policy expense chat
    return !isPolicyExpenseChat(report) || isOwnPolicyExpenseChat;
}

function isGroupChatAdmin(report: OnyxEntry<Report>, accountID: number) {
    if (!report?.participants) {
        return false;
    }

    const reportParticipants = report.participants ?? {};
    const participant = reportParticipants[accountID];
    return participant?.role === CONST.REPORT.ROLE.ADMIN;
}

/**
 * Helper method to define what expense options we want to show for particular method.
 * There are 4 expense options: Submit, Split, Pay and Track expense:
 * - Submit option should show for:
 *     - DMs
 *     - own policy expense chats
 *     - open and processing expense reports tied to own policy expense chat
 *     - unsettled IOU reports
 * - Pay option should show for:
 *     - DMs
 * - Split options should show for:
 *     - DMs
 *     - chat/policy rooms with more than 1 participant
 *     - groups chats with 2 and more participants
 *     - corporate workspace chats
 * - Track expense option should show for:
 *    - Self DMs
 *    - own policy expense chats
 *    - open and processing expense reports tied to own policy expense chat
 * - Send invoice option should show for:
 *    - invoice rooms if the user is an admin of the sender workspace
 * None of the options should show in chat threads or if there is some special Expensify account
 * as a participant of the report.
 */
function getMoneyRequestOptions(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, reportParticipants: number[], filterDeprecatedTypes = false): IOUType[] {
    // In any thread or task report, we do not allow any new expenses yet
    if (isChatThread(report) || isTaskReport(report) || isInvoiceReport(report) || isSystemChat(report)) {
        return [];
    }

    if (isInvoiceRoom(report)) {
        if (isPolicyAdmin(report?.policyID ?? '', allPolicies)) {
            return [CONST.IOU.TYPE.INVOICE];
        }
        return [];
    }

    // We don't allow IOU actions if an Expensify account is a participant of the report, unless the policy that the report is on is owned by an Expensify account
    const doParticipantsIncludeExpensifyAccounts = lodashIntersection(reportParticipants, CONST.EXPENSIFY_ACCOUNT_IDS).length > 0;
    const isPolicyOwnedByExpensifyAccounts = report?.policyID ? CONST.EXPENSIFY_ACCOUNT_IDS.includes(getPolicy(report?.policyID ?? '')?.ownerAccountID ?? 0) : false;
    if (doParticipantsIncludeExpensifyAccounts && !isPolicyOwnedByExpensifyAccounts) {
        return [];
    }

    const otherParticipants = reportParticipants.filter((accountID) => currentUserPersonalDetails?.accountID !== accountID);
    const hasSingleParticipantInReport = otherParticipants.length === 1;
    let options: IOUType[] = [];

    if (isSelfDM(report)) {
        options = [CONST.IOU.TYPE.TRACK];
    }

    // User created policy rooms and default rooms like #admins or #announce will always have the Split Expense option
    // unless there are no other participants at all (e.g. #admins room for a policy with only 1 admin)
    // DM chats will have the Split Expense option.
    // Your own workspace chats will have the split expense option.
    if (
        (isChatRoom(report) && !isAnnounceRoom(report) && otherParticipants.length > 0) ||
        (isDM(report) && otherParticipants.length > 0) ||
        (isGroupChat(report) && otherParticipants.length > 0) ||
        (isPolicyExpenseChat(report) && report?.isOwnPolicyExpenseChat)
    ) {
        options = [CONST.IOU.TYPE.SPLIT];
    }

    if (canRequestMoney(report, policy, otherParticipants)) {
        options = [...options, CONST.IOU.TYPE.SUBMIT];
        if (!filterDeprecatedTypes) {
            options = [...options, CONST.IOU.TYPE.REQUEST];
        }

        // If the user can request money from the workspace report, they can also track expenses
        if (isPolicyExpenseChat(report) || isExpenseReport(report)) {
            options = [...options, CONST.IOU.TYPE.TRACK];
        }
    }

    // Pay someone option should be visible only in 1:1 DMs
    if (isDM(report) && hasSingleParticipantInReport) {
        options = [...options, CONST.IOU.TYPE.PAY];
        if (!filterDeprecatedTypes) {
            options = [...options, CONST.IOU.TYPE.SEND];
        }
    }

    return options;
}

/**
 * This is a temporary function to help with the smooth transition with the oldDot.
 * This function will be removed once the transition occurs in oldDot to new links.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function temporary_getMoneyRequestOptions(
    report: OnyxEntry<Report>,
    policy: OnyxEntry<Policy>,
    reportParticipants: number[],
): Array<Exclude<IOUType, typeof CONST.IOU.TYPE.REQUEST | typeof CONST.IOU.TYPE.SEND>> {
    return getMoneyRequestOptions(report, policy, reportParticipants, true) as Array<Exclude<IOUType, typeof CONST.IOU.TYPE.REQUEST | typeof CONST.IOU.TYPE.SEND>>;
}

/**
 * Invoice sender, invoice receiver and auto-invited admins cannot leave
 */
function canLeaveInvoiceRoom(report: OnyxEntry<Report>): boolean {
    if (!report || !report?.invoiceReceiver) {
        return false;
    }

    if (report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED) {
        return false;
    }

    const isSenderPolicyAdmin = getPolicy(report.policyID)?.role === CONST.POLICY.ROLE.ADMIN;

    if (isSenderPolicyAdmin) {
        return false;
    }

    if (report.invoiceReceiver.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.INDIVIDUAL) {
        return report?.invoiceReceiver?.accountID !== currentUserAccountID;
    }

    const isReceiverPolicyAdmin = getPolicy(report.invoiceReceiver.policyID)?.role === CONST.POLICY.ROLE.ADMIN;

    if (isReceiverPolicyAdmin) {
        return false;
    }

    return true;
}

/**
 * Allows a user to leave a policy room according to the following conditions of the visibility or chatType rNVP:
 * `public` - Anyone can leave (because anybody can join)
 * `public_announce` - Only non-policy members can leave (it's auto-shared with policy members)
 * `policy_admins` - Nobody can leave (it's auto-shared with all policy admins)
 * `policy_announce` - Nobody can leave (it's auto-shared with all policy members)
 * `policyExpenseChat` - Nobody can leave (it's auto-shared with all policy members)
 * `policy` - Anyone can leave (though only policy members can join)
 * `domain` - Nobody can leave (it's auto-shared with domain members)
 * `dm` - Nobody can leave (it's auto-shared with users)
 * `private` - Anybody can leave (though you can only be invited to join)
 * `invoice` - Invoice sender, invoice receiver and auto-invited admins cannot leave
 */
function canLeaveRoom(report: OnyxEntry<Report>, isPolicyEmployee: boolean): boolean {
    if (isInvoiceRoom(report)) {
        if (isArchivedRoom(report)) {
            return false;
        }

        const invoiceReport = getReport(report?.iouReportID ?? '');

        if (invoiceReport?.ownerAccountID === currentUserAccountID) {
            return false;
        }

        if (invoiceReport?.managerID === currentUserAccountID) {
            return false;
        }

        const isSenderPolicyAdmin = getPolicy(report?.policyID)?.role === CONST.POLICY.ROLE.ADMIN;

        if (isSenderPolicyAdmin) {
            return false;
        }

        const isReceiverPolicyAdmin =
            report?.invoiceReceiver?.type === CONST.REPORT.INVOICE_RECEIVER_TYPE.BUSINESS ? getPolicy(report?.invoiceReceiver?.policyID)?.role === CONST.POLICY.ROLE.ADMIN : false;

        if (isReceiverPolicyAdmin) {
            return false;
        }

        return true;
    }

    if (!report?.visibility) {
        if (
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ADMINS ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ANNOUNCE ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.DOMAIN_ALL ||
            report?.chatType === CONST.REPORT.CHAT_TYPE.SELF_DM ||
            !report?.chatType
        ) {
            // DM chats don't have a chatType
            return false;
        }
    } else if (isPublicAnnounceRoom(report) && isPolicyEmployee) {
        return false;
    }
    return true;
}

function isCurrentUserTheOnlyParticipant(participantAccountIDs?: number[]): boolean {
    return Boolean(participantAccountIDs?.length === 1 && participantAccountIDs?.[0] === currentUserAccountID);
}

/**
 * Returns display names for those that can see the whisper.
 * However, it returns "you" if the current user is the only one who can see it besides the person that sent it.
 */
function getWhisperDisplayNames(participantAccountIDs?: number[]): string | undefined {
    const isWhisperOnlyVisibleToCurrentUser = isCurrentUserTheOnlyParticipant(participantAccountIDs);

    // When the current user is the only participant, the display name needs to be "you" because that's the only person reading it
    if (isWhisperOnlyVisibleToCurrentUser) {
        return Localize.translateLocal('common.youAfterPreposition');
    }

    return participantAccountIDs?.map((accountID) => getDisplayNameForParticipant(accountID, !isWhisperOnlyVisibleToCurrentUser)).join(', ');
}

/**
 * Show subscript on workspace chats / threads and expense requests
 */
function shouldReportShowSubscript(report: OnyxEntry<Report>): boolean {
    if (isArchivedRoom(report) && !isWorkspaceThread(report)) {
        return false;
    }

    if (isPolicyExpenseChat(report) && !isChatThread(report) && !isTaskReport(report) && !report?.isOwnPolicyExpenseChat) {
        return true;
    }

    if (isPolicyExpenseChat(report) && !isThread(report) && !isTaskReport(report)) {
        return true;
    }

    if (isExpenseRequest(report)) {
        return true;
    }

    if (isExpenseReport(report) && isOneTransactionReport(report?.reportID ?? '')) {
        return true;
    }

    if (isWorkspaceTaskReport(report)) {
        return true;
    }

    if (isWorkspaceThread(report)) {
        return true;
    }

    if (isInvoiceRoom(report)) {
        return true;
    }

    return false;
}

/**
 * Return true if reports data exists
 */
function isReportDataReady(): boolean {
    return !isEmptyObject(allReports) && Object.keys(allReports ?? {}).some((key) => allReports?.[key]?.reportID);
}

/**
 * Return true if reportID from path is valid
 */
function isValidReportIDFromPath(reportIDFromPath: string): boolean {
    return !['', 'null', '0'].includes(reportIDFromPath);
}

/**
 * Return the errors we have when creating a chat or a workspace room
 */
function getAddWorkspaceRoomOrChatReportErrors(report: OnyxEntry<Report>): Errors | null | undefined {
    // We are either adding a workspace room, or we're creating a chat, it isn't possible for both of these to have errors for the same report at the same time, so
    // simply looking up the first truthy value will get the relevant property if it's set.
    return report?.errorFields?.addWorkspaceRoom ?? report?.errorFields?.createChat;
}

/**
 * Return true if the expense report is marked for deletion.
 */
function isMoneyRequestReportPendingDeletion(report: OnyxEntry<Report> | EmptyObject): boolean {
    if (!isMoneyRequestReport(report)) {
        return false;
    }

    const parentReportAction = ReportActionsUtils.getReportAction(report?.parentReportID ?? '', report?.parentReportActionID ?? '');
    return parentReportAction?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
}

function canUserPerformWriteAction(report: OnyxEntry<Report>, reportNameValuePairs?: OnyxEntry<ReportNameValuePairs>) {
    const reportErrors = getAddWorkspaceRoomOrChatReportErrors(report);

    // If the expense report is marked for deletion, let us prevent any further write action.
    if (isMoneyRequestReportPendingDeletion(report)) {
        return false;
    }

    return !isArchivedRoom(report, reportNameValuePairs) && isEmptyObject(reportErrors) && report && isAllowedToComment(report) && !isAnonymousUser && canWriteInReport(report);
}

/**
 * Returns ID of the original report from which the given reportAction is first created.
 */
function getOriginalReportID(reportID: string, reportAction: OnyxEntry<ReportAction>): string | undefined {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`];
    const currentReportAction = reportActions?.[reportAction?.reportActionID ?? ''] ?? null;
    const transactionThreadReportID = ReportActionsUtils.getOneTransactionThreadReportID(reportID, reportActions ?? ([] as ReportAction[]));
    if (Object.keys(currentReportAction ?? {}).length === 0) {
        return isThreadFirstChat(reportAction, reportID) ? allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`]?.parentReportID : transactionThreadReportID ?? reportID;
    }
    return reportID;
}

/**
 * Return the pendingAction and the errors resulting from either
 *
 * - creating a workspace room
 * - starting a chat
 * - paying the expense
 *
 * while being offline
 */
function getReportOfflinePendingActionAndErrors(report: OnyxEntry<Report>): ReportOfflinePendingActionAndErrors {
    // It shouldn't be possible for all of these actions to be pending (or to have errors) for the same report at the same time, so just take the first that exists
    const reportPendingAction = report?.pendingFields?.addWorkspaceRoom ?? report?.pendingFields?.createChat ?? report?.pendingFields?.reimbursed;

    const reportErrors = getAddWorkspaceRoomOrChatReportErrors(report);
    return {reportPendingAction, reportErrors};
}

/**
 * Check if the report can create the expense with type is iouType
 */
function canCreateRequest(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>, iouType: (typeof CONST.IOU.TYPE)[keyof typeof CONST.IOU.TYPE]): boolean {
    const participantAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    if (!canUserPerformWriteAction(report)) {
        return false;
    }
    return getMoneyRequestOptions(report, policy, participantAccountIDs).includes(iouType);
}

function getWorkspaceChats(policyID: string, accountIDs: number[]): Array<OnyxEntry<Report>> {
    return Object.values(allReports ?? {}).filter((report) => isPolicyExpenseChat(report) && (report?.policyID ?? '') === policyID && accountIDs.includes(report?.ownerAccountID ?? -1));
}

/**
 * Gets all reports that relate to the policy
 *
 * @param policyID - the workspace ID to get all associated reports
 */
function getAllWorkspaceReports(policyID: string): Array<OnyxEntry<Report>> {
    return Object.values(allReports ?? {}).filter((report) => (report?.policyID ?? '') === policyID);
}

/**
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function shouldDisableRename(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    if (isDefaultRoom(report) || isArchivedRoom(report) || isThread(report) || isMoneyRequestReport(report) || isPolicyExpenseChat(report)) {
        return true;
    }

    if (isGroupChat(report)) {
        return false;
    }

    // if the linked workspace is null, that means the person isn't a member of the workspace the report is in
    // which means this has to be a public room we want to disable renaming for
    if (!policy) {
        return true;
    }

    // If there is a linked workspace, that means the user is a member of the workspace the report is in and is allowed to rename.
    return false;
}

/**
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function canEditWriteCapability(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    return PolicyUtils.isPolicyAdmin(policy) && !isAdminRoom(report) && !isArchivedRoom(report) && !isThread(report);
}

/**
 * @param policy - the workspace the report is on, null if the user isn't a member of the workspace
 */
function canEditRoomVisibility(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    return PolicyUtils.isPolicyAdmin(policy) && !isArchivedRoom(report);
}

/**
 * Returns the onyx data needed for the task assignee chat
 */
function getTaskAssigneeChatOnyxData(
    accountID: number,
    assigneeAccountID: number,
    taskReportID: string,
    assigneeChatReportID: string,
    parentReportID: string,
    title: string,
    assigneeChatReport: OnyxEntry<Report>,
): OnyxDataTaskAssigneeChat {
    // Set if we need to add a comment to the assignee chat notifying them that they have been assigned a task
    let optimisticAssigneeAddComment: OptimisticReportAction | undefined;
    // Set if this is a new chat that needs to be created for the assignee
    let optimisticChatCreatedReportAction: OptimisticCreatedReportAction | undefined;
    const currentTime = DateUtils.getDBTime();
    const optimisticData: OnyxUpdate[] = [];
    const successData: OnyxUpdate[] = [];
    const failureData: OnyxUpdate[] = [];

    // You're able to assign a task to someone you haven't chatted with before - so we need to optimistically create the chat and the chat reportActions
    // Only add the assignee chat report to onyx if we haven't already set it optimistically
    if (assigneeChatReport?.isOptimisticReport && assigneeChatReport.pendingFields?.createChat !== CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        optimisticChatCreatedReportAction = buildOptimisticCreatedReportAction(assigneeChatReportID);
        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: {
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                    isHidden: false,
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: optimisticChatCreatedReportAction as Partial<ReportAction>},
            },
        );

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
            value: {
                pendingFields: {
                    createChat: null,
                },
                isOptimisticReport: false,
                // BE will send a different participant. We clear the optimistic one to avoid duplicated entries
                participants: {[assigneeAccountID]: null},
            },
        });

        failureData.push(
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticChatCreatedReportAction.reportActionID]: {pendingAction: null}},
            },
            // If we failed, we want to remove the optimistic personal details as it was likely due to an invalid login
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.PERSONAL_DETAILS_LIST,
                value: {
                    [assigneeAccountID]: null,
                },
            },
        );
    }

    // If you're choosing to share the task in the same DM as the assignee then we don't need to create another reportAction indicating that you've been assigned
    if (assigneeChatReportID !== parentReportID) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const displayname = allPersonalDetails?.[assigneeAccountID]?.displayName || allPersonalDetails?.[assigneeAccountID]?.login || '';
        optimisticAssigneeAddComment = buildOptimisticTaskCommentReportAction(taskReportID, title, assigneeAccountID, `assigned to ${displayname}`, parentReportID);
        const lastAssigneeCommentText = formatReportLastMessageText(optimisticAssigneeAddComment.reportAction.message?.[0]?.text ?? '');
        const optimisticAssigneeReport = {
            lastVisibleActionCreated: currentTime,
            lastMessageText: lastAssigneeCommentText,
            lastActorAccountID: accountID,
            lastReadTime: currentTime,
        };

        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
                value: {[optimisticAssigneeAddComment.reportAction.reportActionID ?? '']: optimisticAssigneeAddComment.reportAction as ReportAction},
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${assigneeChatReportID}`,
                value: optimisticAssigneeReport,
            },
        );
        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
            value: {[optimisticAssigneeAddComment.reportAction.reportActionID ?? '']: {isOptimisticAction: null}},
        });
        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${assigneeChatReportID}`,
            value: {[optimisticAssigneeAddComment.reportAction.reportActionID ?? '']: {pendingAction: null}},
        });
    }

    return {
        optimisticData,
        successData,
        failureData,
        optimisticAssigneeAddComment,
        optimisticChatCreatedReportAction,
    };
}

/**
 * Return iou report action display message
 */
function getIOUReportActionDisplayMessage(reportAction: OnyxEntry<ReportAction>, transaction?: OnyxEntry<Transaction>): string {
    if (reportAction?.actionName !== CONST.REPORT.ACTIONS.TYPE.IOU) {
        return '';
    }
    const originalMessage = reportAction.originalMessage;
    const {IOUReportID} = originalMessage;
    const iouReport = getReport(IOUReportID);
    let translationKey: TranslationPaths;
    if (originalMessage.type === CONST.IOU.REPORT_ACTION_TYPE.PAY) {
        // The `REPORT_ACTION_TYPE.PAY` action type is used for both fulfilling existing requests and sending money. To
        // differentiate between these two scenarios, we check if the `originalMessage` contains the `IOUDetails`
        // property. If it does, it indicates that this is a 'Pay someone' action.
        const {amount, currency} = originalMessage.IOUDetails ?? originalMessage;
        const formattedAmount = CurrencyUtils.convertToDisplayString(Math.abs(amount), currency) ?? '';

        switch (originalMessage.paymentType) {
            case CONST.IOU.PAYMENT_TYPE.ELSEWHERE:
                translationKey = 'iou.paidElsewhereWithAmount';
                break;
            case CONST.IOU.PAYMENT_TYPE.EXPENSIFY:
            case CONST.IOU.PAYMENT_TYPE.VBBA:
                translationKey = 'iou.paidWithExpensifyWithAmount';
                break;
            default:
                translationKey = 'iou.payerPaidAmount';
                break;
        }
        return Localize.translateLocal(translationKey, {amount: formattedAmount, payer: ''});
    }

    const transactionDetails = getTransactionDetails(!isEmptyObject(transaction) ? transaction : null);
    const formattedAmount = CurrencyUtils.convertToDisplayString(transactionDetails?.amount ?? 0, transactionDetails?.currency);
    const isRequestSettled = isSettled(originalMessage.IOUReportID);
    const isApproved = isReportApproved(iouReport);
    if (isRequestSettled) {
        return Localize.translateLocal('iou.payerSettled', {
            amount: formattedAmount,
        });
    }
    if (isApproved) {
        return Localize.translateLocal('iou.approvedAmount', {
            amount: formattedAmount,
        });
    }
    if (ReportActionsUtils.isSplitBillAction(reportAction)) {
        translationKey = 'iou.didSplitAmount';
    } else if (ReportActionsUtils.isTrackExpenseAction(reportAction)) {
        translationKey = 'iou.trackedAmount';
    } else {
        translationKey = 'iou.submittedAmount';
    }
    return Localize.translateLocal(translationKey, {
        formattedAmount,
        comment: transactionDetails?.comment ?? '',
    });
}

/**
 * Checks if a report is a group chat.
 *
 * A report is a group chat if it meets the following conditions:
 * - Not a chat thread.
 * - Not a task report.
 * - Not an expense / IOU report.
 * - Not an archived room.
 * - Not a public / admin / announce chat room (chat type doesn't match any of the specified types).
 * - More than 2 participants.
 *
 */
function isDeprecatedGroupDM(report: OnyxEntry<Report>): boolean {
    return Boolean(
        report &&
            !isChatThread(report) &&
            !isTaskReport(report) &&
            !isInvoiceReport(report) &&
            !isMoneyRequestReport(report) &&
            !isArchivedRoom(report) &&
            !Object.values(CONST.REPORT.CHAT_TYPE).some((chatType) => chatType === getChatType(report)) &&
            Object.keys(report.participants ?? {})
                .map(Number)
                .filter((accountID) => accountID !== currentUserAccountID).length > 1,
    );
}

/**
 * A "root" group chat is the top level group chat and does not refer to any threads off of a Group Chat
 */
function isRootGroupChat(report: OnyxEntry<Report>): boolean {
    return !isChatThread(report) && (isGroupChat(report) || isDeprecatedGroupDM(report));
}

/**
 * Assume any report without a reportID is unusable.
 */
function isValidReport(report?: OnyxEntry<Report>): boolean {
    return Boolean(report?.reportID);
}

/**
 * Check to see if we are a participant of this report.
 */
function isReportParticipant(accountID: number, report: OnyxEntry<Report>): boolean {
    if (!accountID) {
        return false;
    }

    const possibleAccountIDs = Object.keys(report?.participants ?? {}).map(Number);
    if (report?.ownerAccountID) {
        possibleAccountIDs.push(report?.ownerAccountID);
    }
    if (report?.managerID) {
        possibleAccountIDs.push(report?.managerID);
    }
    return possibleAccountIDs.includes(accountID);
}

/**
 * Check to see if the current user has access to view the report.
 */
function canCurrentUserOpenReport(report: OnyxEntry<Report>): boolean {
    return (isReportParticipant(currentUserAccountID ?? 0, report) || isPublicRoom(report)) && canAccessReport(report, allPolicies, allBetas);
}

function shouldUseFullTitleToDisplay(report: OnyxEntry<Report>): boolean {
    return (
        isMoneyRequestReport(report) || isPolicyExpenseChat(report) || isChatRoom(report) || isChatThread(report) || isTaskReport(report) || isGroupChat(report) || isInvoiceReport(report)
    );
}

function getRoom(type: ValueOf<typeof CONST.REPORT.CHAT_TYPE>, policyID: string): OnyxEntry<Report> | undefined {
    const room = Object.values(allReports ?? {}).find((report) => report?.policyID === policyID && report?.chatType === type && !isThread(report));
    return room;
}

/**
 *  We only want policy members who are members of the report to be able to modify the report description, but not in thread chat.
 */
function canEditReportDescription(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | undefined): boolean {
    return (
        !isMoneyRequestReport(report) &&
        !isArchivedRoom(report) &&
        isChatRoom(report) &&
        !isChatThread(report) &&
        !isEmpty(policy) &&
        hasParticipantInArray(report, [currentUserAccountID ?? 0])
    );
}

function canEditPolicyDescription(policy: OnyxEntry<Policy>): boolean {
    return PolicyUtils.isPolicyAdmin(policy);
}

/**
 * Checks if report action has error when smart scanning
 */
function hasSmartscanError(reportActions: ReportAction[]) {
    return reportActions.some((action) => {
        if (!ReportActionsUtils.isSplitBillAction(action) && !ReportActionsUtils.isReportPreviewAction(action)) {
            return false;
        }
        const IOUReportID = ReportActionsUtils.getIOUReportIDFromReportActionPreview(action);
        const isReportPreviewError = ReportActionsUtils.isReportPreviewAction(action) && shouldShowRBRForMissingSmartscanFields(IOUReportID) && !isSettled(IOUReportID);
        const transactionID = (action.originalMessage as IOUMessage).IOUTransactionID ?? '0';
        const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? {};
        const isSplitBillError = ReportActionsUtils.isSplitBillAction(action) && TransactionUtils.hasMissingSmartscanFields(transaction as Transaction);

        return isReportPreviewError || isSplitBillError;
    });
}

function shouldAutoFocusOnKeyPress(event: KeyboardEvent): boolean {
    if (event.key.length > 1) {
        return false;
    }

    // If a key is pressed in combination with Meta, Control or Alt do not focus
    if (event.ctrlKey || event.metaKey) {
        return false;
    }

    if (event.code === 'Space') {
        return false;
    }

    return true;
}

/**
 * Navigates to the appropriate screen based on the presence of a private note for the current user.
 */
function navigateToPrivateNotes(report: OnyxEntry<Report>, session: OnyxEntry<Session>) {
    if (isEmpty(report) || isEmpty(session) || !session.accountID) {
        return;
    }
    const currentUserPrivateNote = report.privateNotes?.[session.accountID]?.note ?? '';
    if (isEmpty(currentUserPrivateNote)) {
        Navigation.navigate(ROUTES.PRIVATE_NOTES_EDIT.getRoute(report.reportID, session.accountID));
        return;
    }
    Navigation.navigate(ROUTES.PRIVATE_NOTES_LIST.getRoute(report.reportID));
}

/**
 * Check if Report has any held expenses
 */
function isHoldCreator(transaction: OnyxEntry<Transaction>, reportID: string): boolean {
    const holdReportAction = ReportActionsUtils.getReportAction(reportID, `${transaction?.comment?.hold ?? ''}`);
    return isActionCreator(holdReportAction);
}

/**
 * Get all held transactions of a iouReport
 */
function getAllHeldTransactions(iouReportID: string): Transaction[] {
    const transactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return transactions.filter((transaction) => TransactionUtils.isOnHold(transaction));
}

/**
 * Check if Report has any held expenses
 */
function hasHeldExpenses(iouReportID?: string): boolean {
    const transactions = TransactionUtils.getAllReportTransactions(iouReportID);
    return transactions.some((transaction) => TransactionUtils.isOnHold(transaction));
}

/**
 * Check if all expenses in the Report are on hold
 */
function hasOnlyHeldExpenses(iouReportID: string, transactions?: OnyxCollection<Transaction>): boolean {
    const reportTransactions = TransactionUtils.getAllReportTransactions(iouReportID, transactions);
    return !reportTransactions.some((transaction) => !TransactionUtils.isOnHold(transaction));
}

/**
 * Checks if thread replies should be displayed
 */
function shouldDisplayThreadReplies(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    const hasReplies = (reportAction?.childVisibleActionCount ?? 0) > 0;
    return hasReplies && !!reportAction?.childCommenterCount && !isThreadFirstChat(reportAction, reportID);
}

/**
 * Check if money report has any transactions updated optimistically
 */
function hasUpdatedTotal(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    if (!report) {
        return true;
    }

    const transactions = TransactionUtils.getAllReportTransactions(report.reportID);
    const hasPendingTransaction = transactions.some((transaction) => !!transaction.pendingAction);
    const hasTransactionWithDifferentCurrency = transactions.some((transaction) => transaction.currency !== report.currency);
    const hasDifferentWorkspaceCurrency = report.pendingFields?.createChat && isExpenseReport(report) && report.currency !== policy?.outputCurrency;

    return !(hasPendingTransaction && (hasTransactionWithDifferentCurrency || hasDifferentWorkspaceCurrency)) && !(hasHeldExpenses(report.reportID) && report?.unheldTotal === undefined);
}

/**
 * Return held and full amount formatted with used currency
 */
function getNonHeldAndFullAmount(iouReport: OnyxEntry<Report>, policy: OnyxEntry<Policy>): string[] {
    const transactions = TransactionUtils.getAllReportTransactions(iouReport?.reportID ?? '');
    const hasPendingTransaction = transactions.some((transaction) => !!transaction.pendingAction);

    if (hasUpdatedTotal(iouReport, policy) && hasPendingTransaction) {
        const unheldTotal = transactions.reduce((currentVal, transaction) => currentVal - (!TransactionUtils.isOnHold(transaction) ? transaction.amount : 0), 0);

        return [CurrencyUtils.convertToDisplayString(unheldTotal, iouReport?.currency), CurrencyUtils.convertToDisplayString((iouReport?.total ?? 0) * -1, iouReport?.currency)];
    }

    return [
        CurrencyUtils.convertToDisplayString((iouReport?.unheldTotal ?? 0) * -1, iouReport?.currency),
        CurrencyUtils.convertToDisplayString((iouReport?.total ?? 0) * -1, iouReport?.currency),
    ];
}

/**
 * Disable reply in thread action if:
 *
 * - The action is listed in the thread-disabled list
 * - The action is a split expense action
 * - The action is deleted and is not threaded
 * - The report is archived and the action is not threaded
 * - The action is a whisper action and it's neither a report preview nor IOU action
 * - The action is the thread's first chat
 */
function shouldDisableThread(reportAction: OnyxEntry<ReportAction>, reportID: string): boolean {
    const isSplitBillAction = ReportActionsUtils.isSplitBillAction(reportAction);
    const isDeletedAction = ReportActionsUtils.isDeletedAction(reportAction);
    const isReportPreviewAction = ReportActionsUtils.isReportPreviewAction(reportAction);
    const isIOUAction = ReportActionsUtils.isMoneyRequestAction(reportAction);
    const isWhisperAction = ReportActionsUtils.isWhisperAction(reportAction) || ReportActionsUtils.isActionableTrackExpense(reportAction);
    const isArchivedReport = isArchivedRoom(getReport(reportID));
    const isActionDisabled = CONST.REPORT.ACTIONS.THREAD_DISABLED.some((action: string) => action === reportAction?.actionName);

    return (
        isActionDisabled ||
        isSplitBillAction ||
        (isDeletedAction && !reportAction?.childVisibleActionCount) ||
        (isArchivedReport && !reportAction?.childVisibleActionCount) ||
        (isWhisperAction && !isReportPreviewAction && !isIOUAction) ||
        isThreadFirstChat(reportAction, reportID)
    );
}

function getAllAncestorReportActions(report: Report | null | undefined): Ancestor[] {
    if (!report) {
        return [];
    }
    const allAncestors: Ancestor[] = [];
    let parentReportID = report.parentReportID;
    let parentReportActionID = report.parentReportActionID;

    // Store the child of parent report
    let currentReport = report;

    while (parentReportID) {
        const parentReport = getReport(parentReportID);
        const parentReportAction = ReportActionsUtils.getReportAction(parentReportID, parentReportActionID ?? '0');

        if (!parentReportAction || ReportActionsUtils.isTransactionThread(parentReportAction) || ReportActionsUtils.isReportPreviewAction(parentReportAction)) {
            break;
        }

        const isParentReportActionUnread = ReportActionsUtils.isCurrentActionUnread(parentReport ?? {}, parentReportAction);
        allAncestors.push({
            report: currentReport,
            reportAction: parentReportAction,
            shouldDisplayNewMarker: isParentReportActionUnread,
        });

        if (!parentReport) {
            break;
        }

        parentReportID = parentReport?.parentReportID;
        parentReportActionID = parentReport?.parentReportActionID;
        if (!isEmptyObject(parentReport)) {
            currentReport = parentReport;
        }
    }

    return allAncestors.reverse();
}

function getAllAncestorReportActionIDs(report: Report | null | undefined, includeTransactionThread = false): AncestorIDs {
    if (!report) {
        return {
            reportIDs: [],
            reportActionsIDs: [],
        };
    }

    const allAncestorIDs: AncestorIDs = {
        reportIDs: [],
        reportActionsIDs: [],
    };
    let parentReportID = report.parentReportID;
    let parentReportActionID = report.parentReportActionID;

    while (parentReportID) {
        const parentReport = getReport(parentReportID);
        const parentReportAction = ReportActionsUtils.getReportAction(parentReportID, parentReportActionID ?? '0');

        if (
            !parentReportAction ||
            (!includeTransactionThread && (ReportActionsUtils.isTransactionThread(parentReportAction) || ReportActionsUtils.isReportPreviewAction(parentReportAction)))
        ) {
            break;
        }

        allAncestorIDs.reportIDs.push(parentReportID ?? '');
        allAncestorIDs.reportActionsIDs.push(parentReportActionID ?? '');

        if (!parentReport) {
            break;
        }

        parentReportID = parentReport?.parentReportID;
        parentReportActionID = parentReport?.parentReportActionID;
    }

    return allAncestorIDs;
}

/**
 * Get optimistic data of parent report action
 * @param reportID The reportID of the report that is updated
 * @param lastVisibleActionCreated Last visible action created of the child report
 * @param type The type of action in the child report
 */
function getOptimisticDataForParentReportAction(reportID: string, lastVisibleActionCreated: string, type: string): Array<OnyxUpdate | EmptyObject> {
    const report = getReport(reportID);

    if (!report || isEmptyObject(report)) {
        return [];
    }

    const ancestors = getAllAncestorReportActionIDs(report, true);
    const totalAncestor = ancestors.reportIDs.length;

    return Array.from(Array(totalAncestor), (_, index) => {
        const ancestorReport = getReport(ancestors.reportIDs[index]);

        if (!ancestorReport || isEmptyObject(ancestorReport)) {
            return {} as EmptyObject;
        }

        const ancestorReportAction = ReportActionsUtils.getReportAction(ancestorReport.reportID, ancestors.reportActionsIDs[index]);

        if (!ancestorReportAction || isEmptyObject(ancestorReportAction)) {
            return {} as EmptyObject;
        }

        return {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${ancestorReport.reportID}`,
            value: {
                [ancestorReportAction?.reportActionID ?? '']: updateOptimisticParentReportAction(ancestorReportAction, lastVisibleActionCreated, type),
            },
        };
    });
}

function canBeAutoReimbursed(report: OnyxEntry<Report>, policy: OnyxEntry<Policy> | EmptyObject): boolean {
    if (isEmptyObject(policy)) {
        return false;
    }
    type CurrencyType = (typeof CONST.DIRECT_REIMBURSEMENT_CURRENCIES)[number];
    const reimbursableTotal = getMoneyRequestSpendBreakdown(report).totalDisplaySpend;
    const autoReimbursementLimit = policy.autoReimbursementLimit ?? 0;
    const isAutoReimbursable =
        isReportInGroupPolicy(report) &&
        policy.reimbursementChoice === CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_YES &&
        autoReimbursementLimit >= reimbursableTotal &&
        reimbursableTotal > 0 &&
        CONST.DIRECT_REIMBURSEMENT_CURRENCIES.includes(report?.currency as CurrencyType);
    return isAutoReimbursable;
}

/** Check if the current user is an owner of the report */
function isReportOwner(report: OnyxEntry<Report>): boolean {
    return report?.ownerAccountID === currentUserPersonalDetails?.accountID;
}

function isAllowedToApproveExpenseReport(report: OnyxEntry<Report>, approverAccountID?: number): boolean {
    const policy = getPolicy(report?.policyID);
    const {preventSelfApproval} = policy;

    const isOwner = (approverAccountID ?? currentUserAccountID) === report?.ownerAccountID;

    return !(preventSelfApproval && isOwner);
}

function isAllowedToSubmitDraftExpenseReport(report: OnyxEntry<Report>): boolean {
    const policy = getPolicy(report?.policyID);
    const submitToAccountID = PolicyUtils.getSubmitToAccountID(policy, report?.ownerAccountID ?? -1);

    return isAllowedToApproveExpenseReport(report, submitToAccountID);
}

/**
 * What missing payment method does this report action indicate, if any?
 */
function getIndicatedMissingPaymentMethod(userWallet: OnyxEntry<UserWallet>, reportId: string, reportAction: ReportAction): MissingPaymentMethod | undefined {
    const isSubmitterOfUnsettledReport = isCurrentUserSubmitter(reportId) && !isSettled(reportId);
    if (!isSubmitterOfUnsettledReport || reportAction.actionName !== CONST.REPORT.ACTIONS.TYPE.REIMBURSEMENT_QUEUED) {
        return undefined;
    }
    const paymentType = reportAction.originalMessage?.paymentType;
    if (paymentType === CONST.IOU.PAYMENT_TYPE.EXPENSIFY) {
        return isEmpty(userWallet) || userWallet.tierName === CONST.WALLET.TIER_NAME.SILVER ? 'wallet' : undefined;
    }

    return !store.hasCreditBankAccount() ? 'bankAccount' : undefined;
}

/**
 * Checks if report chat contains missing payment method
 */
function hasMissingPaymentMethod(userWallet: OnyxEntry<UserWallet>, iouReportID: string): boolean {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${iouReportID}`] ?? {};
    return Object.values(reportActions).some((action) => getIndicatedMissingPaymentMethod(userWallet, iouReportID, action) !== undefined);
}

/**
 * Used from expense actions to decide if we need to build an optimistic expense report.
 * Create a new report if:
 * - we don't have an iouReport set in the chatReport
 * - we have one, but it's waiting on the payee adding a bank account
 * - we have one, but we can't add more transactions to it due to: report is approved or settled, or report is processing and policy isn't on Instant submit reporting frequency
 */
function shouldCreateNewMoneyRequestReport(existingIOUReport: OnyxEntry<Report> | undefined | null, chatReport: OnyxEntry<Report> | null): boolean {
    return !existingIOUReport || hasIOUWaitingOnCurrentUserBankAccount(chatReport) || !canAddOrDeleteTransactions(existingIOUReport);
}

function getTripTransactions(tripRoomReportID: string | undefined): Transaction[] {
    const tripTransactionReportIDs = Object.values(allReports ?? {})
        .filter((report) => report && report?.parentReportID === tripRoomReportID)
        .map((report) => report?.reportID);
    return tripTransactionReportIDs.flatMap((reportID) => TransactionUtils.getAllReportTransactions(reportID));
}

/**
 * Checks if report contains actions with errors
 */
function hasActionsWithErrors(reportID: string): boolean {
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] ?? {};
    return Object.values(reportActions).some((action) => !isEmptyObject(action.errors));
}

function isNonAdminOrOwnerOfPolicyExpenseChat(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    return isPolicyExpenseChat(report) && !(PolicyUtils.isPolicyAdmin(policy) || PolicyUtils.isPolicyOwner(policy, currentUserAccountID ?? -1) || isReportOwner(report));
}

/**
 * Whether the user can join a report
 */
function canJoinChat(report: OnyxEntry<Report>, parentReportAction: OnyxEntry<ReportAction>, policy: OnyxEntry<Policy>): boolean {
    // We disabled thread functions for whisper action
    // So we should not show join option for existing thread on whisper message that has already been left, or manually leave it
    if (ReportActionsUtils.isWhisperAction(parentReportAction)) {
        return false;
    }

    // If the notification preference of the chat is not hidden that means we have already joined the chat
    if (report?.notificationPreference !== CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN) {
        return false;
    }

    // Anyone viewing these chat types is already a participant and therefore cannot join
    if (isRootGroupChat(report) || isSelfDM(report) || isInvoiceRoom(report) || isSystemChat(report)) {
        return false;
    }

    // The user who is a member of the workspace has already joined the public announce room.
    if (isPublicAnnounceRoom(report) && !isEmptyObject(policy)) {
        return false;
    }

    return isChatThread(report) || isUserCreatedPolicyRoom(report) || isNonAdminOrOwnerOfPolicyExpenseChat(report, policy);
}

/**
 * Whether the user can leave a report
 */
function canLeaveChat(report: OnyxEntry<Report>, policy: OnyxEntry<Policy>): boolean {
    if (report?.notificationPreference === CONST.REPORT.NOTIFICATION_PREFERENCE.HIDDEN) {
        return false;
    }

    // Anyone viewing these chat types is already a participant and therefore cannot leave
    if (isSelfDM(report) || isRootGroupChat(report)) {
        return false;
    }

    // The user who is a member of the workspace cannot leave the public announce room.
    if (isPublicAnnounceRoom(report) && !isEmptyObject(policy)) {
        return false;
    }

    if (isInvoiceRoom(report)) {
        return canLeaveInvoiceRoom(report);
    }

    return (isChatThread(report) && !!report?.notificationPreference?.length) || isUserCreatedPolicyRoom(report) || isNonAdminOrOwnerOfPolicyExpenseChat(report, policy);
}

function getReportActionActorAccountID(reportAction: OnyxEntry<ReportAction>, iouReport: OnyxEntry<Report> | undefined): number | undefined {
    switch (reportAction?.actionName) {
        case CONST.REPORT.ACTIONS.TYPE.REPORT_PREVIEW:
            return iouReport ? iouReport.managerID : reportAction?.actorAccountID;

        case CONST.REPORT.ACTIONS.TYPE.SUBMITTED:
            return reportAction?.adminAccountID ?? reportAction?.actorAccountID;

        default:
            return reportAction?.actorAccountID;
    }
}

function createDraftWorkspaceAndNavigateToConfirmationScreen(transactionID: string, actionName: IOUAction): void {
    const isCategorizing = actionName === CONST.IOU.ACTION.CATEGORIZE;
    const {expenseChatReportID, policyID, policyName} = PolicyActions.createDraftWorkspace();
    IOU.setMoneyRequestParticipants(transactionID, [
        {
            selected: true,
            accountID: 0,
            isPolicyExpenseChat: true,
            reportID: expenseChatReportID,
            policyID,
            searchText: policyName,
        },
    ]);
    const iouConfirmationPageRoute = ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, expenseChatReportID);
    if (isCategorizing) {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_CATEGORY.getRoute(actionName, CONST.IOU.TYPE.SUBMIT, transactionID, expenseChatReportID, iouConfirmationPageRoute));
    } else {
        Navigation.navigate(iouConfirmationPageRoute);
    }
}

function createDraftTransactionAndNavigateToParticipantSelector(transactionID: string, reportID: string, actionName: IOUAction, reportActionID: string): void {
    const transaction = allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`] ?? ({} as Transaction);
    const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`] ?? ([] as ReportAction[]);

    if (!transaction || !reportActions) {
        return;
    }

    const linkedTrackedExpenseReportAction = Object.values(reportActions).find((action) => (action.originalMessage as IOUMessage)?.IOUTransactionID === transactionID);

    const {created, amount, currency, merchant, mccGroup} = getTransactionDetails(transaction) ?? {};
    const comment = getTransactionCommentObject(transaction);

    IOU.createDraftTransaction({
        ...transaction,
        actionableWhisperReportActionID: reportActionID,
        linkedTrackedExpenseReportAction,
        linkedTrackedExpenseReportID: reportID,
        created,
        amount,
        currency,
        comment,
        merchant,
        mccGroup,
    } as Transaction);

    const filteredPolicies = Object.values(allPolicies ?? {}).filter(
        (policy) => policy && policy.type !== CONST.POLICY.TYPE.PERSONAL && policy.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
    );

    if (actionName === CONST.IOU.ACTION.SUBMIT || (allPolicies && filteredPolicies.length > 0)) {
        Navigation.navigate(ROUTES.MONEY_REQUEST_STEP_PARTICIPANTS.getRoute(CONST.IOU.TYPE.SUBMIT, transactionID, reportID, undefined, actionName));
        return;
    }

    return createDraftWorkspaceAndNavigateToConfirmationScreen(transactionID, actionName);
}

/**
 * @returns the object to update `report.hasOutstandingChildRequest`
 */
function getOutstandingChildRequest(iouReport: OnyxEntry<Report> | EmptyObject): OutstandingChildRequest {
    if (!iouReport || isEmptyObject(iouReport)) {
        return {};
    }

    if (!isExpenseReport(iouReport)) {
        const {reimbursableSpend} = getMoneyRequestSpendBreakdown(iouReport);
        return {
            hasOutstandingChildRequest: iouReport.managerID === currentUserAccountID && reimbursableSpend !== 0,
        };
    }

    const policy = getPolicy(iouReport.policyID);
    const shouldBeManuallySubmitted = PolicyUtils.isPaidGroupPolicy(policy) && !policy?.harvesting?.enabled;
    const isOwnFreePolicy = PolicyUtils.isFreeGroupPolicy(policy) && PolicyUtils.isPolicyAdmin(policy);
    if (shouldBeManuallySubmitted || isOwnFreePolicy) {
        return {
            hasOutstandingChildRequest: true,
        };
    }

    // We don't need to update hasOutstandingChildRequest in this case
    return {};
}

function canReportBeMentionedWithinPolicy(report: OnyxEntry<Report>, policyID: string): boolean {
    if (report?.policyID !== policyID) {
        return false;
    }

    return isChatRoom(report) && !isThread(report);
}

function shouldShowMerchantColumn(transactions: Transaction[]) {
    return transactions.some((transaction) => isExpenseReport(allReports?.[transaction.reportID] ?? {}));
}

export {
    addDomainToShortMention,
    areAllRequestsBeingSmartScanned,
    buildOptimisticAddCommentReportAction,
    buildOptimisticApprovedReportAction,
    buildOptimisticCancelPaymentReportAction,
    buildOptimisticChangedTaskAssigneeReportAction,
    buildOptimisticChatReport,
    buildOptimisticClosedReportAction,
    buildOptimisticCreatedReportAction,
    buildOptimisticDismissedViolationReportAction,
    buildOptimisticEditedTaskFieldReportAction,
    buildOptimisticExpenseReport,
    buildOptimisticGroupChatReport,
    buildOptimisticHoldReportAction,
    buildOptimisticHoldReportActionComment,
    buildOptimisticIOUReport,
    buildOptimisticIOUReportAction,
    buildOptimisticModifiedExpenseReportAction,
    buildOptimisticMoneyRequestEntities,
    buildOptimisticMovedReportAction,
    buildOptimisticMovedTrackedExpenseModifiedReportAction,
    buildOptimisticRenamedRoomReportAction,
    buildOptimisticReportPreview,
    buildOptimisticActionableTrackExpenseWhisper,
    buildOptimisticSubmittedReportAction,
    buildOptimisticTaskCommentReportAction,
    buildOptimisticTaskReport,
    buildOptimisticTaskReportAction,
    buildOptimisticUnHoldReportAction,
    buildOptimisticWorkspaceChats,
    buildParticipantsFromAccountIDs,
    buildTransactionThread,
    canAccessReport,
    canAddOrDeleteTransactions,
    canBeAutoReimbursed,
    canCreateRequest,
    canCreateTaskInReport,
    canCurrentUserOpenReport,
    canDeleteReportAction,
    canEditFieldOfMoneyRequest,
    canEditMoneyRequest,
    canEditPolicyDescription,
    canEditReportAction,
    canEditReportDescription,
    canEditRoomVisibility,
    canEditWriteCapability,
    canFlagReportAction,
    isNonAdminOrOwnerOfPolicyExpenseChat,
    canLeaveRoom,
    canJoinChat,
    canLeaveChat,
    canReportBeMentionedWithinPolicy,
    canRequestMoney,
    canSeeDefaultRoom,
    canShowReportRecipientLocalTime,
    canUserPerformWriteAction,
    chatIncludesChronos,
    chatIncludesConcierge,
    createDraftTransactionAndNavigateToParticipantSelector,
    doesReportBelongToWorkspace,
    doesTransactionThreadHaveViolations,
    findLastAccessedReport,
    findSelfDMReportID,
    formatReportLastMessageText,
    generateReportID,
    getAddWorkspaceRoomOrChatReportErrors,
    getAllAncestorReportActionIDs,
    getAllAncestorReportActions,
    getAllHeldTransactions,
    getAllPolicyReports,
    getAllWorkspaceReports,
    getAvailableReportFields,
    getBankAccountRoute,
    getChatByParticipants,
    getChatRoomSubtitle,
    getChildReportNotificationPreference,
    getCommentLength,
    getDefaultGroupAvatar,
    getDefaultWorkspaceAvatar,
    getDefaultWorkspaceAvatarTestID,
    getDeletedParentActionMessageForChatReport,
    getDisplayNameForParticipant,
    getDisplayNamesWithTooltips,
    getGroupChatName,
    getIOUReportActionDisplayMessage,
    getIOUReportActionMessage,
    getIcons,
    getIconsForParticipants,
    getIndicatedMissingPaymentMethod,
    getLastUpdatedReport,
    getLastVisibleMessage,
    getMoneyRequestOptions,
    getMoneyRequestSpendBreakdown,
    getNewMarkerReportActionID,
    getNonHeldAndFullAmount,
    getOptimisticDataForParentReportAction,
    getOriginalReportID,
    getOutstandingChildRequest,
    getParentNavigationSubtitle,
    getParsedComment,
    getParticipantAccountIDs,
    getParticipants,
    getPendingChatMembers,
    getPersonalDetailsForAccountID,
    getPolicyDescriptionText,
    getPolicyExpenseChat,
    getPolicyName,
    getPolicyType,
    getReimbursementDeQueuedActionMessage,
    getReimbursementQueuedActionMessage,
    getReport,
    getReportActionActorAccountID,
    getReportDescriptionText,
    getReportFieldKey,
    getReportIDFromLink,
    getReportName,
    getReportNotificationPreference,
    getReportOfflinePendingActionAndErrors,
    getReportParticipantsTitle,
    getReportPolicyID,
    getReportPreviewMessage,
    getReportRecipientAccountIDs,
    getRoom,
    getRoomWelcomeMessage,
    getRootParentReport,
    getRouteFromLink,
    getTaskAssigneeChatOnyxData,
    getTransactionDetails,
    getTransactionReportName,
    getTransactionsWithReceipts,
    getUserDetailTooltipText,
    getVisibleChatMemberAccountIDs,
    getWhisperDisplayNames,
    getWorkspaceAvatar,
    getWorkspaceChats,
    getWorkspaceIcon,
    goBackToDetailsPage,
    goBackFromPrivateNotes,
    getInvoicePayerName,
    getInvoicesChatName,
    getPayeeName,
    hasActionsWithErrors,
    hasAutomatedExpensifyAccountIDs,
    hasExpensifyGuidesEmails,
    hasHeldExpenses,
    hasIOUWaitingOnCurrentUserBankAccount,
    hasMissingPaymentMethod,
    hasMissingSmartscanFields,
    hasNonReimbursableTransactions,
    hasOnlyHeldExpenses,
    hasOnlyTransactionsWithPendingRoutes,
    hasReportNameError,
    hasSmartscanError,
    hasUpdatedTotal,
    hasViolations,
    hasWarningTypeViolations,
    isActionCreator,
    isAdminRoom,
    isAdminsOnlyPostingRoom,
    isAllowedToApproveExpenseReport,
    isAllowedToComment,
    isAllowedToSubmitDraftExpenseReport,
    isAnnounceRoom,
    isArchivedRoom,
    isClosedReport,
    isCanceledTaskReport,
    isChatReport,
    isChatRoom,
    isTripRoom,
    isChatThread,
    isChildReport,
    isClosedExpenseReportWithNoExpenses,
    isCompletedTaskReport,
    isConciergeChatReport,
    isControlPolicyExpenseChat,
    isControlPolicyExpenseReport,
    isCurrentUserSubmitter,
    isCurrentUserTheOnlyParticipant,
    isDM,
    isDefaultRoom,
    isDeprecatedGroupDM,
    isEmptyReport,
    isRootGroupChat,
    isExpenseReport,
    isExpenseRequest,
    isExpensifyOnlyParticipantInReport,
    isGroupChat,
    isGroupChatAdmin,
    isGroupPolicy,
    isReportInGroupPolicy,
    isHoldCreator,
    isIOUOwnedByCurrentUser,
    isIOUReport,
    isIOUReportUsingReport,
    isJoinRequestInAdminRoom,
    isMoneyRequest,
    isMoneyRequestReport,
    isMoneyRequestReportPendingDeletion,
    isOneOnOneChat,
    isOneTransactionThread,
    isOpenExpenseReport,
    isOpenTaskReport,
    isOptimisticPersonalDetail,
    isPaidGroupPolicy,
    isPaidGroupPolicyExpenseChat,
    isPaidGroupPolicyExpenseReport,
    isPayer,
    isPolicyAdmin,
    isPolicyExpenseChat,
    isPolicyExpenseChatAdmin,
    isProcessingReport,
    isPublicAnnounceRoom,
    isPublicRoom,
    isReportApproved,
    isReportDataReady,
    isReportFieldDisabled,
    isReportFieldOfTypeTitle,
    isReportManager,
    isReportMessageAttachment,
    isReportOwner,
    isReportParticipant,
    isSelfDM,
    isSettled,
    isSystemChat,
    isTaskReport,
    isThread,
    isThreadFirstChat,
    isTrackExpenseReport,
    isUnread,
    isUnreadWithMention,
    isUserCreatedPolicyRoom,
    isValidReport,
    isValidReportIDFromPath,
    isWaitingForAssigneeToCompleteTask,
    isInvoiceRoom,
    isInvoiceReport,
    isOpenInvoiceReport,
    canWriteInReport,
    navigateToDetailsPage,
    navigateToPrivateNotes,
    parseReportRouteParams,
    parseReportActionHtmlToText,
    reportFieldsEnabled,
    requiresAttentionFromCurrentUser,
    shouldAutoFocusOnKeyPress,
    shouldCreateNewMoneyRequestReport,
    shouldDisableDetailPage,
    shouldDisableRename,
    shouldDisableThread,
    shouldDisplayThreadReplies,
    shouldDisplayTransactionThreadViolations,
    shouldReportBeInOptionList,
    shouldReportShowSubscript,
    shouldShowFlagComment,
    shouldShowRBRForMissingSmartscanFields,
    shouldUseFullTitleToDisplay,
    sortReportsByLastRead,
    updateOptimisticParentReportAction,
    updateReportPreview,
    temporary_getMoneyRequestOptions,
    getTripTransactions,
    buildOptimisticInvoiceReport,
    getInvoiceChatByParticipants,
    shouldShowMerchantColumn,
    isCurrentUserInvoiceReceiver,
    isDraftReport,
    createDraftWorkspaceAndNavigateToConfirmationScreen,
};

export type {
    Ancestor,
    DisplayNameWithTooltips,
    ExpenseOriginalMessage,
    OptimisticAddCommentReportAction,
    OptimisticChatReport,
    OptimisticClosedReportAction,
    OptimisticCreatedReportAction,
    OptimisticIOUReportAction,
    OptimisticTaskReportAction,
    OptionData,
    TransactionDetails,
    ParsingDetails,
};
