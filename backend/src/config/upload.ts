import path from "path";
import multer from "multer";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
export default {
  directory: publicFolder,

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
	const data = new Date();
	const dia = data.getDate().toString().padStart(2, '0');
  	const mes = (data.getMonth() + 1).toString().padStart(2, '0');
  	const ano = data.getFullYear();
  	const hora = data.getHours().toString().padStart(2, '0');
  	const minuto = data.getMinutes().toString().padStart(2, '0');

	const nomeDoArquivo = `${dia}-${mes}-${ano}-${hora}-${minuto}-${file.originalname}`;

        return cb(null,nomeDoArquivo);
    }
  })
};