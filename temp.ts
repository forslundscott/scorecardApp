import { IncomingMessage } from "http";

declare global {
    namespace Express {
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface AuthInfo {}
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface User {}

        interface Request {
            authInfo?: AuthInfo | undefined;
            user?: User | undefined;

            
            login(user: User, done: (err: any) => void): void;
            login(user: User, options: passport.LogInOptions, done: (err: any) => void): void;
            
            logIn(user: User, done: (err: any) => void): void;
            logIn(user: User, options: passport.LogInOptions, done: (err: any) => void): void;

            
            logout(options: passport.LogOutOptions, done: (err: any) => void): void;
            logout(done: (err: any) => void): void;
            
            logOut(options: passport.LogOutOptions, done: (err: any) => void): void;
            logOut(done: (err: any) => void): void;

            
            isAuthenticated(): this is AuthenticatedRequest;
            
            isUnauthenticated(): this is UnauthenticatedRequest;
        }

        interface AuthenticatedRequest extends Request {
            user: User;
        }

        interface UnauthenticatedRequest extends Request {
            user?: undefined;
        }
    }
}

import express = require("express");

declare namespace passport {
    type DoneCallback = (err: any, user?: Express.User | false | null) => void;
    type DeserializeUserFunction = (serializedUser: unknown, req: express.Request, done: DoneCallback) => void;
    
    type AuthenticateCallback = (
        err: any,
        user?: Express.User | false | null,
        info?: object | string | Array<string | undefined>,
        status?: number | Array<number | undefined>,
    ) => any;
    type AuthorizeCallback = AuthenticateCallback;

    interface AuthenticateOptions {
        authInfo?: boolean | undefined;
        
        assignProperty?: string | undefined;
        
        failureFlash?: string | boolean | undefined;
        
        failureMessage?: boolean | string | undefined;
        
        failureRedirect?: string | undefined;
        failWithError?: boolean | undefined;
        keepSessionInfo?: boolean | undefined;
        
        session?: boolean | undefined;
        scope?: string | string[] | undefined;
        
        successFlash?: string | boolean | undefined;
        
        successMessage?: boolean | string | undefined;
        
        successRedirect?: string | undefined;
        successReturnToOrRedirect?: string | undefined;
        state?: string | undefined;
        
        pauseStream?: boolean | undefined;
        
        userProperty?: string | undefined;
        passReqToCallback?: boolean | undefined;
        prompt?: string | undefined;
    }

    interface InitializeOptions {
        
        userProperty?: string;
        
        compat?: boolean;
    }

    interface SessionOptions {
        
        pauseStream: boolean;
    }

    interface SessionStrategyOptions {
        
        key: string;
    }

    interface LogInOptions extends LogOutOptions {
        
        session: boolean;
    }

    interface LogOutOptions {
        keepSessionInfo?: boolean;
    }

    interface StrategyFailure {
        message?: string;
        [key: string]: any;
    }

    interface Authenticator<
        InitializeRet = express.Handler,
        AuthenticateRet = any,
        AuthorizeRet = AuthenticateRet,
        AuthorizeOptions = AuthenticateOptions,
    > {
        
        use(strategy: Strategy): this;
        use(name: string, strategy: Strategy): this;
        
        unuse(name: string): this;
        
        framework<X, Y, Z>(fw: Framework<X, Y, Z>): Authenticator<X, Y, Z>;
        
        initialize(options?: InitializeOptions): InitializeRet;
        
        session(options?: SessionOptions): AuthenticateRet;

        
        authenticate(
            strategy: string | string[] | Strategy,
            callback?: AuthenticateCallback | ((...args: any[]) => any),
        ): AuthenticateRet;
        authenticate(
            strategy: string | string[] | Strategy,
            options: AuthenticateOptions,
            callback?: AuthenticateCallback | ((...args: any[]) => any),
        ): AuthenticateRet;
        
        authorize(strategy: string | string[], callback?: AuthorizeCallback | ((...args: any[]) => any)): AuthorizeRet;
        authorize(
            strategy: string | string[],
            options: AuthorizeOptions,
            callback?: AuthorizeCallback | ((...args: any[]) => any),
        ): AuthorizeRet;
        
        serializeUser<TID>(fn: (user: Express.User, done: (err: any, id?: TID) => void) => void): void;
        
        serializeUser<TID, TR extends IncomingMessage = express.Request>(
            fn: (req: TR, user: Express.User, done: (err: any, id?: TID) => void) => void,
        ): void;
        
        serializeUser<User extends Express.User = Express.User, Request extends IncomingMessage = express.Request>(
            user: User,
            req: Request,
            done: (err: any, serializedUser?: number | NonNullable<unknown>) => any,
        ): void;
        
        serializeUser<User extends Express.User = Express.User>(
            user: User,
            done: (err: any, serializedUser?: number | NonNullable<unknown>) => any,
        ): void;
       
        deserializeUser<TID>(fn: (id: TID, done: (err: any, user?: Express.User | false | null) => void) => void): void;
        
        deserializeUser<TID, TR extends IncomingMessage = express.Request>(
            fn: (req: TR, id: TID, done: (err: any, user?: Express.User | false | null) => void) => void,
        ): void;
        
        deserializeUser<User extends Express.User = Express.User, Request extends IncomingMessage = express.Request>(
            serializedUser: NonNullable<unknown>,
            req: Request,
            done: (err: any, user?: User | false) => any,
        ): void;
        
        deserializeUser<User extends Express.User = Express.User>(
            serializedUser: NonNullable<unknown>,
            done: (err: any, user?: User | false) => any,
        ): void;
        
        transformAuthInfo(fn: (info: any, done: (err: any, info: any) => void) => void): void;
        
        transformAuthInfo<InitialInfo = unknown, Request extends IncomingMessage = express.Request>(
            info: unknown,
            req: Request,
            done: (err: any, transformedAuthInfo?: InitialInfo | NonNullable<unknown>) => any,
        ): void;
        
        transformAuthInfo<InitialInfo = unknown>(
            info: unknown,
            done: (err: any, transformedAuthInfo?: InitialInfo | NonNullable<unknown>) => any,
        ): void;
    }

    interface PassportStatic extends Authenticator {
        /**
         * Create a new `Authenticator` object.
         */
        Authenticator: { new(): Authenticator };
        /**
         * Create a new `Authenticator` object.
         */
        Passport: PassportStatic["Authenticator"];
        /**
         * Creates an instance of `Strategy`.
         */
        Strategy: { new(): Strategy & StrategyCreatedStatic };
        strategies: {
            
            SessionStrategy: {
                new(deserializeUser: DeserializeUserFunction): SessionStrategy;
                new(options: SessionStrategyOptions, deserializeUser: DeserializeUserFunction): SessionStrategy;
            };
        };
    }

    interface Strategy {
        name?: string | undefined;
        
        authenticate(this: StrategyCreated<this>, req: express.Request, options?: any): any;
    }

    interface SessionStrategy extends Strategy {
        /**
         * The name of the strategy, set to `'session'`.
         */
        readonly name: "session";
        
        authenticate(req: IncomingMessage, options?: Pick<AuthenticateOptions, "pauseStream">): void;
    }

    interface StrategyCreatedStatic {
        
        success(user: Express.User, info?: object): void;
        
        fail(challenge?: StrategyFailure | string | number, status?: number): void;
        
        redirect(url: string, status?: number): void;
        
        pass(): void;
        
        error(err: any): void;
    }

    type StrategyCreated<T, O = T & StrategyCreatedStatic> = {
        [P in keyof O]: O[P];
    };

    interface Profile {
        provider: string;
        id: string;
        displayName: string;
        username?: string | undefined;
        name?:
            | {
                familyName: string;
                givenName: string;
                middleName?: string | undefined;
            }
            | undefined;
        emails?:
            | Array<{
                value: string;
                type?: string | undefined;
            }>
            | undefined;
        photos?:
            | Array<{
                value: string;
            }>
            | undefined;
    }

    interface Framework<InitializeRet = any, AuthenticateRet = any, AuthorizeRet = AuthenticateRet> {
        
        initialize(
            passport: Authenticator<InitializeRet, AuthenticateRet, AuthorizeRet>,
            options?: any,
        ): (...args: any[]) => InitializeRet;
        
        authenticate(
            passport: Authenticator<InitializeRet, AuthenticateRet, AuthorizeRet>,
            name: string,
            options?: any,
            callback?: (...args: any[]) => any,
        ): (...args: any[]) => AuthenticateRet;
        
        authorize?(
            passport: Authenticator<InitializeRet, AuthenticateRet, AuthorizeRet>,
            name: string,
            options?: any,
            callback?: (...args: any[]) => any,
        ): (...args: any[]) => AuthorizeRet;
    }
}

declare const passport: passport.PassportStatic;
export = passport;
