using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;
using System.Security.Cryptography;
using System.Text.Json;

if (args.Length != 2) throw new ArgumentException("Usage: Validator INPUT_DIRECTORY REPORT_JSON");
var results = new List<object>();
var failed = false;
foreach (var file in Directory.GetFiles(args[0], "*.pptx").Order())
{
    var original = File.ReadAllBytes(file);
    var sha = Convert.ToHexString(SHA256.HashData(original)).ToLowerInvariant();
    try
    {
        using var document = PresentationDocument.Open(file, false, new OpenSettings { AutoSave = false });
        var versions = new List<object>();
        foreach (var version in new[] { FileFormatVersions.Office2007, FileFormatVersions.Office2019, FileFormatVersions.Microsoft365 })
        {
            var validator = new OpenXmlValidator(version) { MaxNumberOfErrors = 0 };
            var errors = validator.Validate(document).Select(error => new
            {
                id = error.Id,
                type = error.ErrorType.ToString(),
                description = error.Description,
                part = error.Part?.Uri.ToString(),
                path = error.Path?.XPath,
                node = error.Node?.OuterXml,
                relatedPart = error.RelatedPart?.Uri.ToString(),
                relatedNode = error.RelatedNode?.OuterXml,
            }).ToArray();
            failed |= errors.Length > 0;
            versions.Add(new { target = version.ToString(), errors });
        }
        results.Add(new { file = Path.GetFileName(file), sha256 = sha, versions });
    }
    catch (Exception error)
    {
        failed = true;
        results.Add(new { file = Path.GetFileName(file), sha256 = sha, exception = error.ToString() });
    }
    if (!original.SequenceEqual(File.ReadAllBytes(file))) throw new Exception($"Input changed: {file}");
}
if (results.Count == 0) throw new Exception("No PPTX inputs found.");
File.WriteAllText(args[1], JsonSerializer.Serialize(new
{
    schema = "opf-openxml-audit-v1",
    sdkVersion = typeof(PresentationDocument).Assembly.GetName().Version?.ToString(),
    dotnetVersion = Environment.Version.ToString(),
    scope = "Read-only Open XML SDK package/schema validation. Does not establish native Office, rendering, font, or import fidelity.",
    results,
}, new JsonSerializerOptions { WriteIndented = true }) + "\n");
Console.WriteLine($"Validated {results.Count} PPTX inputs; errors={failed}; report={args[1]}");
return failed ? 1 : 0;
