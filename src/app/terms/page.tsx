import { InfoPage } from "@/components/InfoPage";

/*
 * Terms of Service — full legal text (v1.0).
 *
 * Bracketed placeholders ([Operator Legal Name], [Registered Address],
 * [Licensing Authority], [License Number], [Registration Number], [Date])
 * MUST be filled in with the real corporate/licensing details before this
 * page ships to production. They are deliberately rendered highlighted so an
 * unfilled placeholder is impossible to miss in review.
 *
 * Jurisdiction note: the Prohibited Jurisdictions list (clause 7.3) does NOT
 * include the United States by design of this revision; US users remain
 * responsible for their own local/state/federal compliance (see the version
 * note at the bottom). There is no sports betting section — the platform
 * offers casino games only.
 */

export const metadata = {
  title: "Terms of Service — TOLS Casino",
  description:
    "The Terms of Service governing your use of Tols.fun, including account registration, KYC, deposits, withdrawals, bonuses and responsible gaming.",
};

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-bold text-foreground">{children}</h2>
);

/** Unfilled legal placeholder — highlighted so it cannot slip into production unnoticed. */
const Ph = ({ children }: { children: React.ReactNode }) => (
  <mark className="rounded bg-lime/15 px-1 font-medium text-lime">[{children}]</mark>
);

const Support = () => (
  <a href="mailto:support@tols.fun" className="text-lime underline underline-offset-2">
    support@tols.fun
  </a>
);

export default function Page() {
  return (
    <InfoPage title="Terms of Service">
      <p className="text-muted-foreground">Version 1.0 — <Ph>Date</Ph></p>

      <H2>1. Tols.fun</H2>
      <p>
        Tols.fun (the &quot;Website&quot;) is owned and operated by <Ph>Operator Legal Name</Ph> B.V.
        (&quot;Tols.fun&quot;, &quot;we&quot; or &quot;us&quot;), a company with its registered office located at{" "}
        <Ph>Registered Address</Ph>, Willemstad, Curaçao and registered with the Commercial Register of the Chamber of
        Commerce and Industry in Curaçao under number <Ph>Registration Number</Ph>. Tols.fun is licensed by{" "}
        <Ph>Licensing Authority</Ph> to offer games of chance under license number <Ph>License Number</Ph>.
      </p>

      <H2>2. General</H2>
      <p>
        2.1. These Terms of Service govern your use of the Website and any associated services (the
        &quot;Services&quot;). They constitute a legally binding agreement between you and us and you should read them
        in their entirety before you use the Website or the Services. Your continued use of the Website or the Services
        constitutes acceptance by you of these Terms of Service; if you do not agree to them, you should not continue
        using the Website or the Services.
      </p>
      <p>
        2.2. We may make amendments to these Terms of Service at any time. We will take appropriate steps to bring any
        material changes to your attention (e.g. by notification at login), but it is your responsibility to ensure
        that you agree with any changes made to these Terms of Service and you should continue to check for any updates
        on a regular basis. By continuing to use the Website or any Services after any such amendment to the Terms of
        Service you will be deemed to have accepted and agreed to be bound by such amendments, updates and/or
        modifications. If you do not agree to the changes, then you must not continue to use the Services.
      </p>
      <p>
        2.3. These Terms of Service may be published in several languages. In the case of any discrepancy between the
        English language version of these Terms of Service and versions published in any other languages, the English
        language version shall prevail.
      </p>
      <p>
        2.4. Any games or lotteries made available on the Website as part of the Services may also be subject to their
        own rules, to which you should also refer when participating. The provisions of these Terms of Service shall
        prevail in the event of any conflict with any such rules.
      </p>
      <p>
        2.5. For the avoidance of any doubt, the information contained in these Terms of Service is not intended to
        encourage participation in the Services, and does not constitute an offer or invitation by us or any of our
        employees or consultants to any person to participate in the Services.
      </p>

      <H2>3. Tols.fun Account registration</H2>
      <p>
        3.1. In order for you to be able to place bets via the Website, you must first register for an account
        (&quot;Tols.fun Account&quot;). As part of the Tols.fun Account registration process, you will be required to
        provide your date of birth and a valid email address and choose a username and password for your Tols.fun
        Account. You must enter all mandatory information requested in the registration form. It is your sole
        responsibility to ensure that the information you provide is true, complete and correct. We may reject your
        requested username if we deem it to be offensive or inappropriate.
      </p>
      <p>3.2. You may not register for a Tols.fun Account if:</p>
      <ol className="list-[lower-alpha] space-y-1 pl-5">
        <li>
          You are under 18 years old or under the legal age of majority for gambling in the jurisdiction in which you
          are located;
        </li>
        <li>
          You are residing or located in jurisdictions from which gambling or your use of the Services is not
          permitted. It is your responsibility to ensure that your use of the Services is lawful; or
        </li>
        <li>
          You provide misleading information or try to register for a Tols.fun Account through third parties. You are
          prohibited from selling, transferring or acquiring Tols.fun Accounts to or from other Tols.fun users.
        </li>
      </ol>
      <p>
        3.3. You are fully and solely responsible for the security of your login details and other sensitive
        information, including passwords and cryptocurrency wallets and associated private keys. We are not liable for
        any loss or damage arising from abuse or misuse of your Tols.fun Account by third parties due to your
        disclosure, whether intentional, accidental, active or passive, of any such information to any third party.
      </p>
      <p>
        3.4. You are permitted to have only one Tols.fun Account. If you attempt to open more than one Tols.fun
        Account, any and all such accounts may be blocked, suspended or closed, and any sums credited to those accounts
        will be frozen and may be deducted. If you realise that you have opened more than one registered Tols.fun
        Account you must notify us immediately by email at <Support />.
      </p>
      <p>
        3.5. If at any time after registration of your Tols.fun Account you become aware of any errors or incorrect
        information relating to your Tols.fun Account, you must inform us as soon as possible by email at <Support />.
      </p>

      <H2>4. Know-your-customer (&quot;KYC&quot;)</H2>
      <p>
        4.1. We reserve the right, at any time, to ask you for KYC documentation if we deem it necessary in order to
        determine your identity, location or age, or for any other purpose. We reserve the right to restrict your
        ability to access any or all Services or to make payments or withdrawals until your identity has been
        determined to our satisfaction, at our sole discretion.
      </p>
      <p>
        4.2. We reserve the right to disclose your information to third parties as appropriate to comply with any legal
        process or as otherwise permitted under our privacy policy, and by using any Service, you acknowledge and
        consent to the possibility of such disclosure. Please refer to Tols.fun&apos;s{" "}
        <a href="/aml" className="text-lime underline underline-offset-2">AML Policy</a> for more information.
      </p>

      <H2>5. Conditions of use</H2>
      <p>5.1. As a condition of your use of the Services, you represent, warrant, covenant and agree that:</p>
      <ol className="list-[lower-alpha] space-y-1 pl-5">
        <li>
          You are the older of (i) 18 years of age and (ii) the legal age determined by any laws applicable to you
          regarding your use of the Website and the Services;
        </li>
        <li>
          You have full capacity to enter into a legally binding agreement with us and you are not restricted by any
          form of limited legal capacity;
        </li>
        <li>Your use of the Services is at your sole option, discretion and risk;</li>
        <li>
          You are fully aware that there is a risk of losing funds when using the Website and the Services and you
          agree that we bear no responsibility to you for any such loss;
        </li>
        <li>
          You acknowledge that the funds in your Tols.fun Account are consumed instantly when playing games and that we
          do not provide refunds;
        </li>
        <li>
          You accept and acknowledge that the prevailing market value of cryptocurrencies can change dramatically;
        </li>
        <li>You have not been diagnosed or classified as a compulsive or problem gambler;</li>
        <li>
          You are not currently self-excluded from any gambling site or gambling premises, and you will inform us
          immediately if you enter into a self-exclusion agreement with any gambling provider;
        </li>
        <li>
          You are accessing the Website from a jurisdiction in which it is legal to do so, and will not use our
          Services while located in any jurisdiction that prohibits the placing and/or accepting of bets online and/or
          playing casino and/or live games or which otherwise prohibits access to or use of the Services;
        </li>
        <li>
          All information that you provide to us during the term of validity of these Terms of Service is true, correct
          and complete, and that you will immediately notify us if any such information changes;
        </li>
        <li>
          You participate in the Tols.fun games strictly in your personal and non-professional capacity and for
          recreational and entertainment purposes only;
        </li>
        <li>You participate in Tols.fun games on your own behalf and not on behalf of any other person;</li>
        <li>
          You will not use or access the Website or Services for any purpose that is (1) illegal under any law
          applicable to you or (2) prohibited by or in breach of these Terms of Service;
        </li>
        <li>
          You will not collude with or assist, or attempt to collude with or assist, any third parties, or use any
          device, robot, spider, algorithm, software, routine or other method (or anything in the nature of the
          foregoing), in order to defraud us or interfere with the functioning or operational performance of the
          Website or the Services;
        </li>
        <li>
          You will not use the Website or Services in any way which interferes or may interfere with other users, or
          make any attempt to gain an unfair advantage over other users, whether specifically prohibited by the
          applicable rules or not;
        </li>
        <li>
          You will not disseminate any information which is unlawful, harassing, abusive, threatening, libellous,
          defamatory, obscene, indecent, inflammatory, racially or ethnically objectionable, pornographic or profane,
          or any material that could constitute or encourage conduct that would be considered a criminal offence or
          could give rise to civil liability;
        </li>
        <li>
          In relation to deposits and withdrawals of funds into and from your Tols.fun Account (including
          cryptocurrencies and any other currencies that may be used from time to time), you will only use funds which
          have been legally obtained and which belong to you. You will not use funds which originate from criminal or
          other illegal or unauthorised activities;
        </li>
        <li>
          You acknowledge that we may take measures to detect and prevent unauthorised or illegal activity. These steps
          may include, but are not limited to, examination of your device properties, geolocation, detection of IP
          masking, and blockchain transaction analysis;
        </li>
        <li>
          If you become aware of any suspicious activity relating to any of the games on the Website, you will report
          this to us immediately by contacting us by email at <Support />;
        </li>
        <li>
          You acknowledge that we may suspend, block or close a Tols.fun Account and withhold funds if we deem it
          necessary to assist in the prevention of money laundering or other illegal activity;
        </li>
        <li>
          You are fully and solely responsible for obtaining your own independent financial, accounting and tax advice,
          and for recording, reporting, paying and accounting to any relevant governmental or taxation authority for
          any tax or other levy that may be payable on any winnings or other sums that you receive from using the
          Services;
        </li>
        <li>
          You will keep your username, password and cryptocurrency wallet private keys confidential and take
          appropriate steps to prevent unauthorised access or use;
        </li>
        <li>
          You will immediately change your password and notify us if your username or password is compromised in any
          way;
        </li>
        <li>You agree not to open more than one Tols.fun Account;</li>
        <li>
          You acknowledge that we may modify or withdraw any of the Services at any time without prior notice to you;
          and
        </li>
        <li>
          You acknowledge that we are not liable for any outages, slowness, capacity constraints or other deficiencies
          affecting the telecommunications networks or internet services required for you to access and use the
          Services.
        </li>
      </ol>
      <p>
        5.2. We will be entitled to close or suspend your Tols.fun Account in the event of a breach of any of the above
        representations, warranties or covenants, or if we consider it likely that there has been or will be any such
        breach. We may also close or suspend your Tols.fun Account if asked to do so by the police, any regulatory
        authority or court or if we are unable to verify any of the KYC information provided by you.
      </p>

      <H2>6. No Tols.fun warranties</H2>
      <p>
        6.1. The Services are provided to you on an &quot;as is&quot; basis. We disclaim any and all warranties,
        expressed or implied, in connection with the Services. In particular, we provide you with no warranty or
        representation whatsoever regarding the Services&apos; quality, fitness for purpose, completeness, or accuracy,
        and we make no warranty that any Service will be uninterrupted, timely or error-free, or that any defects will
        be corrected. In particular, Tols.fun does not represent or warrant that the Website is or will be free from
        errors, bugs and other defects in its functioning, that access to the Services is or will be continuous,
        uninterrupted, timely, or secure, that the information made available via, contained on or used by the Website
        is or will be accurate, reliable, complete, or current, that the Website will be free from viruses or other
        harmful material, or that the Website will be suitable for the particular purpose that you have in mind when
        using it. Information made available via, contained on or used by the Website may be inaccurate or incomplete
        or otherwise unreliable for a variety of reasons, for example as a result of software bugs, data feed
        interruptions, platform or server downtime, or other issues, and this may cause losses to you by affecting the
        functioning of the Services or the resolution of games. Links and frames connecting the Website with other
        websites are for convenience only and do not mean that we endorse or approve those other websites, their
        content or the people who run them.
      </p>
      <p>
        6.2. Tols.fun may from time to time test new games and other features on the Website by introducing them in
        beta testing form (&quot;Beta Features&quot;). If you choose to use these Beta Features you do so on the
        understanding that (i) such features may be particularly unstable and prone to errors and bugs and other
        defects in functioning and (ii) Tols.fun will not be liable for any losses sustained as a result. Beta Features
        may need to be suspended, discontinued or modified at any time. Any winnings credited to your Tols.fun Account
        which relate to any technical or human error involving a Beta Feature may be deducted at Tols.fun&apos;s sole
        discretion.
      </p>

      <H2>7. Prohibited uses</H2>
      <p>
        7.1. The use of the Website or any of the Services for any form of illicit activity, including money
        laundering, terrorist financing or trade sanctions violations, is prohibited.
      </p>
      <p>
        7.2. The Website and the Services are not offered to individuals or entities subject to United States, European
        Union, or other global sanctions or watchlists. By using the Website and the Services, you represent and
        warrant that you are not subject to such sanctions.
      </p>
      <p>
        7.3. Persons located or resident in Australia, the Cayman Islands, Curaçao, Germany, the Netherlands, Portugal,
        Singapore, Spain, Sweden, the United Kingdom and any other location from which use of the Services is not
        permitted under applicable laws or regulations or where provision of the Services would require licensing or
        registration or which is embargoed by the United States of America, the European Union or the United Kingdom
        (the &quot;Prohibited Jurisdictions&quot;) are not permitted to access the Website or the Services. These
        restrictions apply equally to residents and citizens of other jurisdictions while they are located in a
        Prohibited Jurisdiction.
      </p>
      <p>
        7.4. Any attempt to conceal your true location through the use of a VPN, proxy, or similar service or through
        the provision of incorrect or misleading information about your place of residence or location will constitute
        a breach of these Terms of Service.
      </p>

      <H2>8. Deposits</H2>
      <p>
        8.1. You may only participate in a Tols.fun game if you have sufficient funds for such participation in your
        Tols.fun Account.
      </p>
      <p>8.2. You may not deposit funds which originate from criminal or other unauthorised activity.</p>
      <p>
        8.3. To deposit funds into your Tols.fun Account, you may transfer funds from a cryptocurrency wallet under
        your control or via any of the other payment methods that may be available from time to time on the Website.
        Deposits may only be made with your own funds.
      </p>
      <p>
        8.4. We take no responsibility for any delays to deposits which may arise from or be associated with blockchain
        transaction times or the use of particular payment methods or which may be caused by any third party.
      </p>
      <p>
        8.5. We reserve the right to use additional procedures and means to verify your identity when processing
        deposits into your Tols.fun Account.
      </p>
      <p>
        8.6. Please note that the use of some payment methods may involve additional fees. Your bank or payment service
        provider may also charge you additional fees for making transfers or converting currencies.
      </p>
      <p>
        8.7. We may refuse to credit any deposits at our own discretion. If your Tols.fun Account has been blocked or
        suspended, you must refrain from attempting to deposit funds into it. Should you attempt to deposit funds when
        your Tols.fun Account is blocked or suspended, (i) you acknowledge and accept the risk that such deposited
        funds may be permanently lost, and (ii) if those deposited funds are not lost, we will have the right to retain
        them.
      </p>

      <H2>9. Withdrawals</H2>
      <p>
        9.1. Cryptocurrency withdrawals will be made to your stated cryptocurrency wallet address after you make a
        valid withdrawal request.
      </p>
      <p>
        9.2. Withdrawals may be restricted if we detect suspicious, unauthorised or illegal activity relating to your
        Tols.fun Account.
      </p>
      <p>
        9.3. If we mistakenly credit your Tols.fun Account with winnings or any other sums that do not belong to you,
        whether as a result of a technical error or human error or otherwise, such sums will remain our property and
        will be liable to be deducted from your Tols.fun Account. In the event of an incorrect credit to your Tols.fun
        Account, you are obliged to notify us immediately by email at <Support /> upon becoming aware of any such
        error. If you withdraw funds that do not belong to you before we become aware of such an error, those amounts
        credited to your Tols.fun Account in error will (without prejudice to other remedies and actions that may be
        available at law) constitute a debt owed by you to us.
      </p>
      <p>
        9.4. If your Tols.fun Account has been closed, locked, blocked or excluded and you wish to recover funds held
        in it, please contact Tols.fun customer support at <Support />. We reserve the right to refuse to reopen or
        unlock your Tols.fun Account or to allow withdrawals from it if we suspect that you are in breach of these
        Terms of Service or if we deem it necessary to do so for other reasons, and we may carry out additional KYC
        verification procedures and other checks for any withdrawal.
      </p>

      <H2>10. Winnings and Bonuses</H2>
      <p>
        10.1. All wagers and bets are placed in the particular digital asset or cryptocurrency specified. Any values
        expressed in fiat currency, including USD, are provided for indicative, reference purposes only.
      </p>
      <p>
        10.2. Your winnings will be paid out in the same asset or currency used to place the bet or wager for that
        particular game.
      </p>
      <p>
        10.3. We may from time to time offer you bonuses and rewards, such as free spins, cashback, and extra money or
        wager assets to play games with (&quot;Bonuses&quot;). Any such Bonuses will have their own sets of terms and
        conditions, to which you will need to agree in order to participate. We reserve the right to modify any
        promotion concerning Bonuses or to discontinue or terminate the promotion at any time. Your eligibility to
        participate in the promotion and receive any Bonuses is determined by Tols.fun in its sole discretion.
      </p>
      <p>
        10.4. We reserve our right to remove any bonus from inactive accounts and accounts that we determine at our
        sole discretion to be intentionally exploiting a Bonus in bad faith.
      </p>
      <p>
        10.5. We reserve the right to cancel all Bonuses that have not been claimed within the shorter of any
        applicable claiming period or 60 days, and to cancel any Bonus at our sole discretion.
      </p>
      <p>
        10.6. Users are only eligible to receive winnings and Bonuses if they are not in breach of these Terms of
        Service.
      </p>

      <H2>11. Breach</H2>
      <p>
        11.1. Without prejudice to any other rights, if you breach in whole or in part any provision contained herein,
        we reserve the right to take such action as we see fit, including closing or suspending your Tols.fun Account
        and/or deducting funds from it, terminating our relationship with you under these Terms of Service or any other
        agreement and/or taking legal action against you.
      </p>
      <p>
        11.2. You hereby fully indemnify, defend and hold harmless Tols.fun and its shareholders, directors, employees
        and agents from and against all costs, expenses, losses, damages, claims, demands and liabilities (including
        legal fees and any other charges) that may be incurred or suffered by Tols.fun or its shareholders, directors,
        employees and agents, arising in any way from (i) any breach by you of any part of these Terms of Service; (ii)
        any violation by you of any law or any third party rights; or (iii) your use of the Services.
      </p>

      <H2>12. Limitation of liability</H2>
      <p>
        12.1. Under no circumstances shall we be liable for any claims, proceedings, liabilities, costs, losses or
        special, incidental, direct, indirect or consequential damages (including, without limitation, damages for loss
        of business profits, business interruption, loss of business information, or any other pecuniary loss) arising
        out of the use or misuse of the Services. This limitation of liability applies (1) regardless of whether the
        alleged liability is based on contract, tort, strict liability, statutory liability or any other basis, (2)
        even in the case of our own negligence, and (3) even if we have been advised of the possibility of such
        liability.
      </p>
      <p>
        12.2. The limitations of liability in these Terms of Service shall apply to the fullest extent permitted under
        applicable laws.
      </p>

      <H2>13. Intellectual property</H2>
      <p>
        13.1. We and our licensors are the sole holders of all rights in and to the Services and related code,
        structure and organisation, including copyright, trade secrets, intellectual property and other rights. You may
        not, within the limits prescribed by applicable laws (a) copy, distribute, publish, reverse engineer,
        decompile, disassemble, modify, or translate the website, or (b) use any Service in a manner prohibited by
        applicable laws or regulations (each of the above is an &quot;Unauthorised Use&quot;). We reserve any and all
        rights, implied or otherwise, which are not expressly granted to you hereunder and retain all rights, title and
        interest in and to the Services. You agree that you will be solely liable for any damage, costs or expenses
        arising out of or in connection with the commission by you of any Unauthorised Use. You will notify us
        immediately upon becoming aware of the commission by any person of any Unauthorised Use and will provide us
        with reasonable assistance with any investigations it conducts in light of the information provided by you in
        this respect.
      </p>
      <p>
        13.2. The term &quot;Tols.fun&quot;, its domain names and any other trademarks and service marks used by us as
        part of the Services (the &quot;Trademarks&quot;), are solely owned by us. In addition, all content on the
        Website, including, but not limited to, the images, pictures, graphics, photographs, animations, videos, music,
        audio and text (the &quot;Site Contents&quot;) belongs to us and is protected by copyright and/or other
        intellectual property or other rights. You hereby acknowledge that by using the Services, you obtain no rights
        in the Site Contents and/or the Trademarks, or any part thereof. Under no circumstances may you use the Site
        Contents and/or the Trademarks without our prior written consent. You also agree not to do anything that would,
        or would be reasonably likely to, harm or potentially harm our rights, including our intellectual property
        rights.
      </p>

      <H2>14. Complaints</H2>
      <p>
        If you wish to make a complaint regarding the Services, you may contact our customer support team by email at{" "}
        <Support />. Please see our Complaints Handling Procedures.
      </p>

      <H2>15. Responsible Gaming</H2>
      <p>
        You may select various options to limit your gambling such as self-excluding, closing your account, or setting
        responsible wager and/or loss limits. Please see our{" "}
        <a href="/responsible-gaming" className="text-lime underline underline-offset-2">
          Responsible Gaming and Self-Exclusion Policy
        </a>
        .
      </p>

      <H2>16. Governing law and jurisdiction</H2>
      <p>
        16.1. These Terms of Service will be governed by, and construed in accordance with, the laws of Curaçao.
      </p>
      <p>
        16.2. The courts of Curaçao will have non-exclusive jurisdiction to settle any dispute arising from or
        connected with these Terms of Service (including a dispute relating to their existence, validity or
        termination, or the consequences of their nullity, or any non-contractual obligation arising out of or in
        connection with them).
      </p>
      <p>
        16.3. You must bring any and all legal claims under these Terms of Service in your individual capacity and not
        as a claimant in or member of any purported class action, collective action, private attorney general action,
        or other representative proceeding. You agree to waive the right to demand a trial by jury, where applicable.
      </p>

      <H2>17. Severability</H2>
      <p>
        If any provision of these Terms of Service is or becomes illegal, invalid or unenforceable in any jurisdiction,
        that shall not affect the validity or enforceability in that jurisdiction of any other provision of these Terms
        of Service or the validity or enforceability in other jurisdictions of that or any other provision.
      </p>

      <H2>18. Assignment</H2>
      <p>
        We reserve the right to assign our rights under these Terms of Service, in whole or in part, at any time
        without notice. You may not assign any of your rights or obligations under these Terms of Service.
      </p>

      <H2>19. Miscellaneous</H2>
      <p>
        19.1. No waiver by us of any breach of any provision of these Terms of Service shall in any way be construed as
        a waiver of any subsequent breach of such provision or of any breach of any other provision of these Terms of
        Service.
      </p>
      <p>
        19.2. Nothing in these Terms of Service shall create or confer any rights or other benefits in favour of any
        third parties.
      </p>
      <p>
        19.3. Nothing in these Terms of Service shall create or be deemed to create a partnership, agency, trust
        arrangement, fiduciary relationship or joint venture between you and us.
      </p>
      <p>19.4. Any communications with us regarding use of the Services shall be retained for a period of six years.</p>
      <p>
        19.5. These Terms of Service constitute the entire understanding and agreement between you and us regarding the
        Services and supersede any prior agreement, understanding, or arrangement between you and us.
      </p>

      <hr className="mt-8 border-border/40" />
      <p className="text-xs text-muted-foreground/80">
        Note: The United States is not listed among the Prohibited Jurisdictions in clause 7.3. However, users are
        still responsible for complying with all applicable local, state, and federal laws in the United States
        regarding online gambling.
      </p>
    </InfoPage>
  );
}
