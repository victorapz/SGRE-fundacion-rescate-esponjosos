import { buildPublicSponsorshipRichTextHtml } from "../../utils/publicSponsorship";

export default function SafeRichText({
  value,
  className = "",
}) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: buildPublicSponsorshipRichTextHtml(value),
      }}
    />
  );
}
