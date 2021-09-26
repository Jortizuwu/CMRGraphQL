// resolvers
const Usuario = require("../models/Usuarios");
const Prodcuto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: ".env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;
  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

const resolvers = {
  Query: {
    // Usuarios
    obtenerUsuario: async (_, {}, ctx) => {
      return ctx.usuario;
    },
    // Productos
    obtenerProductos: async () => {
      try {
        return await Prodcuto.find({});
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //revisar si el producto existe
      const producto = await Prodcuto.findById(id);
      if (!producto) throw new Error("Producto no existe");
      return producto;
    },
    // Clientes
    ObtenerClientes: async () => {
      try {
        return await Cliente.find({});
      } catch (error) {
        console.log(error);
      }
    },
    ObtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        return await Cliente.find({ vendedor: ctx.usuario.id.toString() });
      } catch (error) {
        console.log(error);
      }
    },
    ObtenerCliente: async (_, { id }, ctx) => {
      // revisar si el cliente existe
      const cliente = await Cliente.findById(id);

      if (!cliente) throw new Error("cliente no encontrado");

      // quiem lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("no tienes las credenciales");
      }

      return cliente;
    },
    // Pedidos
    ObtenerPedidos: async () => {
      try {
        return await Pedido.find({});
      } catch (error) {
        console.log(error);
      }
    },
    ObtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        return await Pedido.find({ vendedor: ctx.usuario.id });
      } catch (error) {
        console.log(error);
      }
    },
    ObtenerPedido: async (_, { id }, ctx) => {
      // si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) throw new Error("pedido no encontrado");

      // solo quien lo creo puede verlo
      if (pedido.vendedor.toString() !== ctx.usuario.id)
        throw new Error("accion no permitida");

      // retornar el resultado
      return pedido;
    },
    ObtenerPedidoEstado: async (_, { estado }, ctx) =>
      await Pedido.find({ vendedor: ctx.usuario.id, estado }),
    mejoresClientes: async () => {
      const cliente = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return cliente;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) =>
      await Prodcuto.find({ $text: { $search: texto } }).limit(10),
  },
  Mutation: {
    // Usuarios
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;
      // Resivasar si el usuario esta creado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("el gmail ya esta en uso");
      }

      // Heshear su password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        // Guadar en la base de datos
        const usuario = new Usuario(input);
        usuario.save();
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    auteticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      // ver si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("el usuario no existe");
      }

      // revisar si el password es correcto
      passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("el password no es correcto");
      }

      // crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    // Productos
    nuevoProducto: async (_, { input }) => {
      try {
        const nuevoProducto = new Prodcuto(input);

        // alamacenar en la db
        const resultado = await nuevoProducto.save();

        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      //revisar si el producto existe
      let producto = await Prodcuto.findById(id);
      if (!producto) throw new Error("Producto no existe");

      // guardar en la base de datos
      producto = await Prodcuto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //revisar si el producto existe
      let producto = await Prodcuto.findById(id);
      if (!producto) throw new Error("Producto no existe");

      // eliminar
      await Prodcuto.findByIdAndDelete({ _id: id });
      return "Producto eliminado";
    },
    // Clientes
    nuevoCliente: async (_, { input }, ctx) => {
      const { email } = input;
      // verificar si el cliente esta registrado
      const cliente = await Cliente.findOne({ email });
      if (cliente) throw new Error("Cliente ya registrado");

      const nuevoClient = new Cliente(input);

      //asignar el vendedor
      nuevoClient.vendedor = ctx.usuario.id;

      //guardarlo en a base de datos
      try {
        return await nuevoClient.save();
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      // verificar si existe el cliente
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("no existe el cliente");

      // verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id)
        throw new Error("no tienes las credenciales");

      // guardar cliente
      return await Cliente.findOneAndUpdate({ _id: id }, input, { new: true });
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // verificar si existe el cliente
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("no existe el cliente");

      // verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id)
        throw new Error("no tienes las credenciales");

      // eliminar
      await Cliente.findOneAndDelete({ _id: id }, input, { new: true });
      return "Cliente eliminado correctamente";
    },
    // Pedido
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;
      // verificar si el cliente existe
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) throw new Error("el cliente no existe");

      // verificar si el cliente es el del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id)
        throw new Error("No tienes las credenciales");

      // verificar la disponibilidad del stock
      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Prodcuto.findById(id);
        if (articulo.cantidad > producto.existencia) {
          throw new Error("la cantidad pedida excede la cantidad disponible");
        } else {
          // revisar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      //crear nuevo pedido
      const nuevoPedido = new Pedido(input);

      // asignar un vendedor
      nuevoPedido.vendedor = ctx.usuario.id;

      // guardar en la db
      return await nuevoPedido.save();
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      // Si el pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error("El pedido no existe");
      }

      // Si el cliente existe
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error("El cliente no existe");
      }

      // Si el cliente y pedido pertenece al vendedor
      if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      // Revisar el stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Prodcuto.findById(id);
          if (articulo.cantidad > producto.existencia) {
            throw new Error("la cantidad pedida excede la cantidad disponible");
          } else {
            // revisar la cantidad a lo disponible
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      // Guardar pedido
      return await Pedido.findOneAndUpdate({ _id: id }, input, { new: true });
    },
    eliminarCliente: async (_, { id }, ctx) => {
      // verificar si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("el pedido no existe");
      }

      // verificar si el vendedor es quien lo borra
      if (pedido.vendedor.toString() !== ctx.usuario.id)
        throw new Error("no tienes las credenciales");

      // elimiar de la db
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido eliminado";
    },
  },
};

module.exports = resolvers;
